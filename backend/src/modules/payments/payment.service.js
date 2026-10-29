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
export function paymentService(config, provider) {
  return {
    async checkout(id, user, input) {
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
          if (String(old.booking) !== id || old.outcome !== input.outcome)
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
        p.status = result.status;
        p.providerReference = result.reference;
        if (result.status === 'HELD') {
          p.paidAt = new Date();
          p.heldAt = p.paidAt;
        }
        await p.save({ session });
        b.payment = p._id;
        if (result.status === 'HELD') {
          await ledger(p, 'CUSTOMER_PAYMENT', p.amountBututs, session);
          await ledger(p, 'PLATFORM_FEE', p.platformFeeBututs, session);
          await ledger(
            p,
            'WORKER_PENDING_EARNING',
            p.workerAmountBututs,
            session,
          );
          b.status = 'CONFIRMED';
        }
        await b.save({ session });
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
