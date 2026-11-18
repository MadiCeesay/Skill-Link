import mongoose from 'mongoose';
import {
  Payment,
  PaymentAttempt,
  FinancialLedgerEntry,
} from './payment.model.js';
import { Booking } from '../bookings/booking.model.js';
import { User } from '../users/user.model.js';
import { participantBooking } from '../bookings/booking.service.js';
import {
  ensureWorkerLock,
  lockWorker,
} from '../availability/availability.service.js';
import { transaction } from '../../utils/transaction.js';
import { ApiError } from '../../utils/ApiError.js';
import { paymentDTO, ledgerDTO } from './payment.serializer.js';
export function breakdown(amount, bps) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !Number.isInteger(bps) ||
    bps < 0 ||
    bps > 10000
  )
    throw new ApiError(400, 'INVALID_MONEY', 'Invalid amount or commission');
  const fee = Number((BigInt(amount) * BigInt(bps)) / 10000n);
  return {
    amountBututs: amount,
    platformFeeBututs: fee,
    workerAmountBututs: amount - fee,
    commissionBasisPoints: bps,
  };
}
export async function ledger(payment, type, amount, session) {
  await FinancialLedgerEntry.create(
    [
      {
        payment: payment._id,
        booking: payment.booking,
        customer: payment.customer,
        worker: payment.worker,
        type,
        amountBututs: amount,
      },
    ],
    { session },
  );
}
export async function settlePayment(booking, decision, session) {
  const p = await Payment.findOne({
    _id: booking.payment,
    booking: booking._id,
  }).session(session);
  if (!p || !['HELD', 'DISPUTED'].includes(p.status))
    throw new ApiError(
      409,
      'PAYMENT_NOT_HELD',
      'Simulated funds must be held before settlement',
    );
  if (decision === 'RELEASE_TO_WORKER') {
    p.status = 'RELEASED';
    p.releasedAt = new Date();
    await ledger(p, 'WORKER_RELEASE', p.workerAmountBututs, session);
  } else {
    p.status = 'REFUNDED';
    p.refundedAt = new Date();
    await ledger(p, 'REFUND', p.amountBututs, session);
  }
  await p.save({ session });
  return p;
}
// Records a successful customer payment: funds are held by SkillLink until the work
// is confirmed, the ledger gets its three entries, and the booking is confirmed.
async function holdPayment(p, b, session) {
  p.status = 'HELD';
  p.paidAt = new Date();
  p.heldAt = p.paidAt;
  await p.save({ session });
  await ledger(p, 'CUSTOMER_PAYMENT', p.amountBututs, session);
  await ledger(p, 'PLATFORM_FEE', p.platformFeeBututs, session);
  await ledger(p, 'WORKER_PENDING_EARNING', p.workerAmountBututs, session);
  b.payment = p._id;
  b.status = 'CONFIRMED';
  await b.save({ session });
}
export function paymentService(config, provider) {
  // Creates (or reuses) the PENDING payment and a Modem Pay checkout for it.
  async function startRedirectCheckout(b, user, input, session) {
    let p = await Payment.findOne({ booking: b._id }).session(session);
    if (p && ['HELD', 'RELEASED', 'REFUNDED', 'DISPUTED'].includes(p.status))
      throw new ApiError(409, 'ALREADY_PAID', 'This booking already has a successful payment');
    if (!p)
      p = new Payment({
        booking: b._id, customer: b.customer, worker: b.worker,
        ...breakdown(b.agreedAmountBututs, config.COMMISSION_BASIS_POINTS ?? 1000),
        provider: provider.name, status: 'PENDING',
      });
    p.provider = provider.name;
    p.status = 'PENDING';
    await p.save({ session });
    const checkout = await provider.createCheckout({ bookingId: b._id, paymentId: p._id, amountBututs: p.amountBututs });
    p.providerReference = checkout.reference;
    await p.save({ session });
    b.payment = p._id;
    await b.save({ session });
    await PaymentAttempt.create([{
      customer: user._id, booking: b._id, payment: p._id, key: input.idempotencyKey,
      outcome: 'REDIRECT', resultStatus: 'PENDING', providerReference: checkout.reference, redirectUrl: checkout.redirectUrl,
    }], { session });
    return { payment: paymentDTO(p), attempt: { status: 'PENDING', providerReference: checkout.reference }, redirectUrl: checkout.redirectUrl, idempotent: false };
  }
  // Applies a result reported by a real provider (webhook or status check).
  // Safe to call many times for the same payment: only the first success counts.
  async function applyProviderResult({ paymentId, intentId, outcome, amount }) {
    const found = await Payment.findOne(paymentId
      ? { _id: paymentId, provider: provider.name }
      : { providerReference: intentId, provider: provider.name });
    if (!found) return {};
    await ensureWorkerLock(found.worker);
    return transaction(async (session) => {
      await lockWorker(found.worker, session);
      const p = await Payment.findById(found._id).session(session);
      if (p.status !== 'PENDING' && p.status !== 'FAILED') return { payment: paymentDTO(p), idempotent: true };
      if (outcome === 'PENDING') return { payment: paymentDTO(p), idempotent: true };
      if (outcome === 'FAILED') {
        if (p.status === 'PENDING') { p.status = 'FAILED'; await p.save({ session }); }
        return { payment: paymentDTO(p) };
      }
      const expected = provider.toProviderAmount(p.amountBututs);
      if (amount !== null && amount !== undefined && Math.abs(Number(amount) - expected) > 0.001) {
        console.warn('[payments] amount mismatch for payment ' + p._id + ': expected ' + expected + ', provider reported ' + amount);
        throw new ApiError(409, 'PAYMENT_AMOUNT_MISMATCH', 'The paid amount does not match the booking');
      }
      const b = await Booking.findById(p.booking).session(session);
      if (!b || b.status !== 'AWAITING_PAYMENT') {
        // Paid after the booking closed (e.g. cancelled): needs a manual refund in the Modem Pay dashboard.
        console.warn('[payments] payment ' + p._id + ' succeeded but booking ' + p.booking + ' is ' + (b?.status || 'missing') + '; refund manually');
        return { payment: paymentDTO(p), idempotent: true };
      }
      if (intentId) p.providerReference = String(intentId).slice(0, 100);
      await holdPayment(p, b, session);
      return { payment: paymentDTO(p) };
    });
  }
  return {
    providerInfo() {
      return { provider: provider.name, redirects: Boolean(provider.redirects) };
    },
    async checkout(id, user, input) {
      if (!provider.redirects && !input.outcome)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a payment result');
      const initial = await participantBooking(id, user);
      if (String(initial.customer) !== String(user._id))
        throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
      await ensureWorkerLock(initial.worker);
      return transaction(async (session) => {
        await lockWorker(initial.worker, session);
        const b = await Booking.findOneAndUpdate(
          { _id: id, customer: user._id },
          { $inc: { revision: 1 } },
          { new: true, session },
        );
        const old = await PaymentAttempt.findOne({
          customer: user._id,
          key: input.idempotencyKey,
        }).session(session);
        if (old) {
          if (String(old.booking) !== id || old.outcome !== (provider.redirects ? 'REDIRECT' : input.outcome))
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was used with a different request',
            );
          const p = await Payment.findById(old.payment).session(session);
          return {
            payment: paymentDTO(p),
            attempt: {
              status: old.resultStatus,
              providerReference: old.providerReference,
            },
            ...(old.redirectUrl ? { redirectUrl: old.redirectUrl } : {}),
            idempotent: true,
          };
        }
        if (
          b.status !== 'AWAITING_PAYMENT' ||
          b.reservationExpiresAt <= new Date() ||
          b.scheduledStart <= new Date()
        )
          throw new ApiError(
            409,
            'BOOKING_NOT_PAYABLE',
            'Booking is closed, already paid, or its reservation expired',
          );
        if (
          !(await User.exists({
            _id: b.worker,
            role: 'WORKER',
            accountStatus: 'ACTIVE',
          }).session(session))
        )
          throw new ApiError(409, 'WORKER_INACTIVE', 'Worker is unavailable');
        if (provider.redirects) return startRedirectCheckout(b, user, input, session);
        const result = await provider.checkout({
          booking: id,
          amountBututs: b.agreedAmountBututs,
          outcome: input.outcome,
        });
        if (
          !['PENDING', 'FAILED', 'HELD'].includes(result.status) ||
          typeof result.reference !== 'string' ||
          result.reference.length > 100
        )
          throw new ApiError(
            502,
            'INVALID_PROVIDER_RESPONSE',
            'Payment provider returned an invalid response',
          );
        let p = await Payment.findOne({ booking: id }).session(session);
        if (
          p &&
          ['HELD', 'RELEASED', 'REFUNDED', 'DISPUTED'].includes(p.status)
        )
          throw new ApiError(
            409,
            'ALREADY_PAID',
            'This booking already has a successful payment',
          );
        if (!p)
          p = new Payment({
            booking: id,
            customer: b.customer,
            worker: b.worker,
            ...breakdown(
              b.agreedAmountBututs,
              config.COMMISSION_BASIS_POINTS ?? 1000,
            ),
            provider: provider.name,
            status: result.status,
          });
        p.providerReference = result.reference;
        if (result.status === 'HELD') await holdPayment(p, b, session);
        else {
          p.status = result.status;
          await p.save({ session });
          b.payment = p._id;
          await b.save({ session });
        }
        await PaymentAttempt.create(
          [
            {
              customer: user._id,
              booking: id,
              payment: p._id,
              key: input.idempotencyKey,
              outcome: input.outcome,
              resultStatus: p.status,
              providerReference: p.providerReference,
            },
          ],
          { session },
        );
        return {
          payment: paymentDTO(p),
          attempt: { status: p.status, providerReference: p.providerReference },
          idempotent: false,
        };
      });
    },
    // Called when the customer comes back from Modem Pay: asks Modem Pay for the result.
    async verifyProviderPayment(id, user) {
      const initial = await participantBooking(id, user);
      if (String(initial.customer) !== String(user._id)) throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
      const p = await Payment.findOne({ booking: id });
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
      if (!provider.redirects || p.provider !== provider.name || p.status !== 'PENDING' || !p.providerReference)
        return { payment: paymentDTO(p), idempotent: true };
      const state = await provider.retrieve(p.providerReference);
      return applyProviderResult({ paymentId: p._id, intentId: p.providerReference, outcome: state.outcome, amount: state.amount });
    },
    // Modem Pay's signed notification. Unknown events are acknowledged and ignored.
    async handleWebhook(rawBody, signature) {
      if (!provider.redirects || !provider.verifySignature(rawBody, signature))
        throw new ApiError(400, 'INVALID_SIGNATURE', 'Webhook signature is invalid');
      const { event, payload = {} } = JSON.parse(rawBody);
      const outcomes = { 'charge.succeeded': 'SUCCEEDED', 'charge.failed': 'FAILED', 'payment_intent.cancelled': 'FAILED' };
      if (!outcomes[event]) return {};
      const metadata = payload.metadata || payload.payment_intent?.metadata || {};
      const paymentId = mongoose.isValidObjectId(metadata.payment_id) ? metadata.payment_id : null;
      const intentId = payload.payment_intent_id || payload.payment_intent?.id || (event.startsWith('payment_intent') ? payload.id : null);
      if (!paymentId && !intentId) return {};
      return applyProviderResult({ paymentId, intentId, outcome: outcomes[event], amount: event === 'charge.succeeded' ? payload.amount : null });
    },
    async own(id, user) {
      const p = await Payment.findOne({
        _id: id,
        ...(user.role === 'ADMIN'
          ? {}
          : mongoose.trusted({
              $or: [{ customer: user._id }, { worker: user._id }],
            })),
      });
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
      return { payment: paymentDTO(p) };
    },
    async booking(id, user) {
      await participantBooking(id, user);
      const p = await Payment.findOne({ booking: id });
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
      return { payment: paymentDTO(p) };
    },
    async balance(worker) {
      const rows = await Payment.aggregate([
        { $match: { worker: new mongoose.Types.ObjectId(worker) } },
        {
          $group: {
            _id: '$status',
            amount: { $sum: { $toDecimal: '$workerAmountBututs' } },
          },
        },
      ]);
      const value = (status) =>
        rows
          .filter((r) => status.includes(r._id))
          .reduce((sum, r) => sum + BigInt(r.amount.toString()), 0n)
          .toString();
      return {
        simulated: true,
        currency: 'GMD',
        pendingEarningsBututs: value(['HELD', 'DISPUTED']),
        releasedEarningsBututs: value(['RELEASED']),
      };
    },
    async entries(id, user) {
      const p = await this.own(id, user);
      return {
        payment: p.payment,
        entries: (
          await FinancialLedgerEntry.find({ payment: id }).sort({
            createdAt: 1,
            _id: 1,
          })
        ).map(ledgerDTO),
      };
    },
  };
}
