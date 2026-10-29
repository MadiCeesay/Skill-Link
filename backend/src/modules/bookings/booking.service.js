import mongoose from 'mongoose';
import { Booking } from './booking.model.js';
import { DirectProposal } from './proposal.model.js';
import { Quote } from '../quotes/quote.model.js';
import { JobRequest } from '../jobRequests/job.model.js';
import { User } from '../users/user.model.js';
import { Review } from '../reviews/review.model.js';
import { WorkerProfile } from '../workers/worker.model.js';
import { Availability } from '../availability/availability.model.js';
import {
  ensureWorkerLock,
  lockWorker,
  withinAvailability,
  slotBlocking,
} from '../availability/availability.service.js';
import { transaction } from '../../utils/transaction.js';
import { ApiError } from '../../utils/ApiError.js';
import { areaKey } from '../matching/matching.service.js';
import { bookingDTO, proposalDTO } from './booking.serializer.js';
import { pageMetadata } from '../discovery/discovery.service.js';
export const same = (a, b) => String(a) === String(b);
export async function participantBooking(id, user, session = null) {
  const filter = {
    _id: id,
    ...(user.role === 'ADMIN'
      ? {}
      : mongoose.trusted({
          $or: [{ customer: user._id }, { worker: user._id }],
        })),
  };
  const b = await Booking.findOne(filter).session(session);
  if (!b) throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
  return b;
}
export function bookingService(config, matching, media) {
  async function photos(ids, customer, session = null) {
    if (!ids?.length) return;
    await media.ownedMany(ids, customer, 'JOB_ATTACHMENT', session);
  }
  const open = p => ['PENDING', 'QUOTED'].includes(p.status) && p.expiresAt > new Date();
  async function proposalBooking(p, amount, session) {
    return create({ customer: p.customer, worker: p.worker, service: p.service,
      directProposal: p._id, description: p.description, agreedAmountBututs: amount,
      serviceArea: p.serviceArea.toObject(), location: p.location?.toObject(), privateAddress: p.privateAddress },
    { scheduledStart: p.scheduledStart, scheduledEnd: p.scheduledEnd }, session);
  }
  async function create(source, input, session) {
    await lockWorker(source.worker, session);
    if (
      !(await User.exists({
        _id: source.customer,
        role: 'CUSTOMER',
        accountStatus: 'ACTIVE',
      }).session(session))
    )
      throw new ApiError(409, 'CUSTOMER_INACTIVE', 'Customer is unavailable');
    await matching.assert(
      source.worker,
      { ...source, areaKey: areaKey(source.serviceArea.name) },
      session,
    );
    const a = await Availability.findOne({ worker: source.worker }).session(
      session,
    );
    if (!withinAvailability(a, input.scheduledStart, input.scheduledEnd))
      throw new ApiError(
        409,
        'OUTSIDE_AVAILABILITY',
        'Select a time within worker availability and outside time off',
      );
    if (
      input.scheduledStart <= new Date() ||
      input.scheduledEnd <= input.scheduledStart ||
      input.scheduledEnd - input.scheduledStart > 86400000
    )
      throw new ApiError(400, 'INVALID_SCHEDULE', 'Invalid booking interval');
    const conflict = {
      worker: source.worker,
      scheduledStart: mongoose.trusted({ $lt: input.scheduledEnd }),
      scheduledEnd: mongoose.trusted({ $gt: input.scheduledStart }),
      ...mongoose.trusted(slotBlocking(new Date())),
    };
    if (
      await Booking.exists(conflict)
        .setOptions({ sanitizeFilter: false })
        .session(session)
    )
      throw new ApiError(
        409,
        'BOOKING_CONFLICT',
        'The worker already has a reservation or active booking at this time',
      );
    const [b] = await Booking.create(
      [
        {
          ...source,
          ...input,
          status: 'AWAITING_PAYMENT',
          reservationExpiresAt: new Date(
            Math.min(
              Date.now() + (config.BOOKING_RESERVATION_MINUTES ?? 15) * 60000,
              input.scheduledStart.getTime(),
            ),
          ),
        },
      ],
      { session },
    );
    return b;
  }
  return {
    async fromQuote(customer, input) {
      const q = await Quote.findOne({
        _id: input.quote,
        customer,
        status: 'ACCEPTED',
      });
      if (!q) throw new ApiError(404, 'NOT_FOUND', 'Accepted quote not found');
      await ensureWorkerLock(q.worker);
      return transaction(async (session) => {
        const quote = await Quote.findOne({
          _id: input.quote,
          customer,
          status: 'ACCEPTED',
        }).session(session);
        const job = await JobRequest.findOne({
          _id: quote?.jobRequest,
          customer,
          status: 'QUOTE_ACCEPTED',
          acceptedQuote: quote?._id,
        }).session(session);
        if (!job?.agreement)
          throw new ApiError(
            409,
            'INVALID_AGREEMENT',
            'Accepted agreement is unavailable',
          );
        await lockWorker(quote.worker, session);
        const old = await Booking.findOne({ acceptedQuote: quote._id }).session(
          session,
        );
        if (old) return { booking: bookingDTO(old, { _id: customer }) };
        const b = await create(
          {
            customer: job.customer,
            worker: quote.worker,
            service: job.service,
            jobRequest: job._id,
            acceptedQuote: quote._id,
            description: job.agreement.jobDescription,
            agreedAmountBututs: job.agreement.agreedAmountBututs,
            serviceArea: job.serviceArea.toObject(),
            location: job.location?.toObject(),
            privateAddress: job.privateAddress,
          },
          {
            scheduledStart: input.scheduledStart,
            scheduledEnd: input.scheduledEnd,
          },
          session,
        );
        return { booking: bookingDTO(b, { _id: customer }) };
      });
    },
    async propose(customer, input) {
      await matching.assert(input.worker, {
        ...input,
        customer,
        areaKey: areaKey(input.serviceArea.name),
      });
      await photos(input.attachments, customer);
      let listedPrice, agreedAmountBututs = input.agreedAmountBututs;
      if (input.pricingMode === 'LISTED_PRICE') {
        const profile = await WorkerProfile.findOne({ user: input.worker });
        const price = profile?.pricing.find(p => same(p.service, input.service));
        if (price?.type !== 'FIXED' || !Number.isSafeInteger(price.amountBututs) || price.amountBututs <= 0)
          throw new ApiError(409, 'FIXED_PRICE_UNAVAILABLE', 'This service requires a professional quote');
        if (input.listedAmountBututs !== price.amountBututs)
          throw new ApiError(409, 'LISTED_PRICE_CHANGED', 'The listed price has changed. Refresh the professional profile');
        listedPrice = { type: price.type, amountBututs: price.amountBututs };
        agreedAmountBututs = price.amountBututs;
      }
      const { listedAmountBututs: _listedAmount, ...stored } = input;
      const p = await DirectProposal.create({
        ...stored,
        agreedAmountBututs,
        listedPrice,
        customer,
        expiresAt: new Date(
          Math.min(Date.now() + 3 * 86400000, input.scheduledStart.getTime()),
        ),
      });
      return { proposal: proposalDTO(p, { _id: customer }) };
    },
    async proposals(user, page) {
      const filter =
        user.role === 'WORKER' ? { worker: user._id } : { customer: user._id };
      const [rows, total] = await Promise.all([
        DirectProposal.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page.page - 1) * page.limit)
          .limit(page.limit),
        DirectProposal.countDocuments(filter),
      ]);
      return {
        proposals: await Promise.all(rows.map(async (p) => ({
          ...proposalDTO(p, user),
          customerSummary: await User.findById(p.customer).select('firstName lastName -_id').lean(),
        }))),
        pagination: pageMetadata(page.page, page.limit, total),
      };
    },
    async proposal(id, user) {
      const p = await DirectProposal.findOne({
        _id: id,
        ...mongoose.trusted({
          $or: [{ worker: user._id }, { customer: user._id }],
        }),
      });
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Proposal not found');
      return { proposal: { ...proposalDTO(p, user), customerSummary: await User.findById(p.customer).select('firstName lastName -_id').lean() } };
    },
    async attachment(id, mediaId, user) {
      const p = await DirectProposal.findOne({ _id: id,
        ...mongoose.trusted({ $or: [{ customer: user._id }, { worker: user._id }] }) });
      if (!p || !p.attachments.some(a => same(a, mediaId)))
        throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
      return media.jobAttachment(mediaId, p.customer);
    },
    async sendQuote(id, user, input) {
      const initial = await DirectProposal.findOne({ _id: id, worker: user._id });
      if (!initial) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
      await ensureWorkerLock(initial.worker);
      return transaction(async session => {
        await lockWorker(initial.worker, session);
        const p = await DirectProposal.findById(id).session(session);
        if (!open(p) || p.pricingMode !== 'REQUEST_QUOTE')
          throw new ApiError(409, 'REQUEST_CLOSED', 'Only an open quote request can receive a quote');
        if (input.revision !== p.quoteRevision || p.quoteRevision >= 100)
          throw new ApiError(409, 'QUOTE_CHANGED', 'The quote has changed. Refresh before trying again');
        await matching.assert(p.worker, { service: p.service, customer: p.customer,
          serviceArea: p.serviceArea, areaKey: areaKey(p.serviceArea.name), location: p.location?.toObject() }, session);
        const expiresAt = input.expiresAt || p.expiresAt;
        if (!(expiresAt > new Date()) || expiresAt > p.expiresAt)
          throw new ApiError(400, 'INVALID_EXPIRY', 'Quote expiry must be before the request deadline');
        p.quoteRevision += 1;
        p.quotes.push({ revision: p.quoteRevision, amountBututs: input.amountBututs,
          note: input.note, expiresAt, createdAt: new Date() });
        p.status = 'QUOTED';
        await p.save({ session });
        return { proposal: proposalDTO(p, user) };
      });
    },
    async acceptQuote(id, user, input) {
      const initial = await DirectProposal.findOne({ _id: id, customer: user._id });
      if (!initial) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
      await ensureWorkerLock(initial.worker);
      return transaction(async session => {
        await lockWorker(initial.worker, session);
        const p = await DirectProposal.findById(id).session(session);
        if (p.status === 'ACCEPTED' && p.pricingMode === 'REQUEST_QUOTE' && p.quoteRevision === input.revision)
          return { proposal: proposalDTO(p, user) };
        const quote = p.quotes.at(-1);
        if (!open(p) || p.status !== 'QUOTED' || !quote || quote.expiresAt <= new Date() || quote.revision !== input.revision)
          throw new ApiError(409, 'QUOTE_CHANGED', 'Only the current valid quote can be accepted. Refresh the request');
        const b = await proposalBooking(p, quote.amountBututs, session);
        p.agreedAmountBututs = quote.amountBututs;
        p.booking = b._id;
        p.status = 'ACCEPTED';
        await p.save({ session });
        return { proposal: proposalDTO(p, user) };
      });
    },
    async decide(id, user, action) {
      const initial = await DirectProposal.findOne({
        _id: id,
        ...(action === 'CANCELLED'
          ? { customer: user._id }
          : action === 'QUOTE_DECLINED' ? { customer: user._id }
          : { worker: user._id }),
      });
      if (!initial) throw new ApiError(404, 'NOT_FOUND', 'Proposal not found');
      await ensureWorkerLock(initial.worker);
      return transaction(async (session) => {
        await lockWorker(initial.worker, session);
        const p = await DirectProposal.findById(id).session(session);
        if (!open(p))
          throw new ApiError(
            409,
            'PROPOSAL_NOT_PENDING',
            'Proposal is closed or expired',
          );
        if (action === 'ACCEPTED') {
          if (p.pricingMode === 'REQUEST_QUOTE')
            throw new ApiError(409, 'QUOTE_REQUIRED', 'Send a quote for the customer to accept first');
          const b = await create(
            {
              customer: p.customer,
              worker: p.worker,
              service: p.service,
              directProposal: p._id,
              description: p.description,
              agreedAmountBututs: p.agreedAmountBututs,
              serviceArea: p.serviceArea.toObject(),
              location: p.location?.toObject(),
              privateAddress: p.privateAddress,
            },
            { scheduledStart: p.scheduledStart, scheduledEnd: p.scheduledEnd },
            session,
          );
          p.booking = b._id;
        }
        if (action === 'QUOTE_DECLINED' && p.status !== 'QUOTED')
          throw new ApiError(409, 'QUOTE_NOT_PENDING', 'There is no quote to decline');
        p.status = action === 'QUOTE_DECLINED' ? 'REJECTED' : action;
        await p.save({ session });
        return { proposal: proposalDTO(p, user) };
      });
    },
    async own(id, user) {
      const booking = await participantBooking(id, user);
      const customerOwns = user.role === 'CUSTOMER' && same(booking.customer, user._id);
      const existingReview = customerOwns
        ? await Review.findOne({ booking: booking._id, customer: user._id }).select('_id')
        : null;
      return {
        booking: bookingDTO(booking, user),
        reviewEligibility: {
          canReview: customerOwns && booking.status === 'COMPLETED' && !existingReview,
          hasReviewed: Boolean(existingReview),
        },
      };
    },
    async list(user, page) {
      const filter =
        user.role === 'WORKER' ? { worker: user._id } : { customer: user._id };
      const [rows, total] = await Promise.all([
        Booking.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page.page - 1) * page.limit)
          .limit(page.limit),
        Booking.countDocuments(filter),
      ]);
      return {
        bookings: rows.map((b) => bookingDTO(b, user)),
        pagination: pageMetadata(page.page, page.limit, total),
      };
    },
    async cancel(id, user, input) {
      const initial = await participantBooking(id, user);
      await ensureWorkerLock(initial.worker);
      return transaction(async (session) => {
        await lockWorker(initial.worker, session);
        const b = await participantBooking(id, user, session);
        if (b.status !== 'AWAITING_PAYMENT')
          throw new ApiError(
            409,
            'INVALID_TRANSITION',
            'Only unpaid reservations can be cancelled; paid jobs require dispute/refund handling',
          );
        b.status = 'CANCELLED';
        b.cancelledAt = new Date();
        b.cancellationReason = input.reason;
        await b.save({ session });
        return { booking: bookingDTO(b, user) };
      });
    },
  };
}
