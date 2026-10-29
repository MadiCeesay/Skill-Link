import mongoose from 'mongoose';
import { Booking } from './booking.model.js';
import { participantBooking } from './booking.service.js';
import { bookingDTO } from './booking.serializer.js';
import { Dispute } from '../disputes/dispute.model.js';
import { Review } from '../reviews/review.model.js';
import { Payment } from '../payments/payment.model.js';
import { WorkerProfile } from '../workers/worker.model.js';
import { MediaAsset } from '../media/media.model.js';
import { settlePayment } from '../payments/payment.service.js';
import {
  ensureWorkerLock,
  lockWorker,
} from '../availability/availability.service.js';
import { recordAudit } from '../admin/audit.model.js';
import { transaction } from '../../utils/transaction.js';
import { ApiError } from '../../utils/ApiError.js';
import { disputeDTO, reviewDTO } from './lifecycle.serializer.js';
import { pageMetadata } from '../discovery/discovery.service.js';
const same = (a, b) => String(a) === String(b);
async function reputation(worker, session) {
  const [r] = await Review.aggregate([
    {
      $match: {
        worker: new mongoose.Types.ObjectId(worker),
        moderationStatus: 'VISIBLE',
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]).session(session);
  const completedJobsCount = await Booking.countDocuments({
    worker,
    status: 'COMPLETED',
  }).session(session);
  await WorkerProfile.updateOne(
    { user: worker },
    {
      $set: {
        averageRating: r?.averageRating || 0,
        reviewCount: r?.reviewCount || 0,
        completedJobsCount,
      },
    },
    { session },
  );
}
export function lifecycleService(media) {
  async function work(id, user, fn) {
    const initial = await participantBooking(id, user);
    await ensureWorkerLock(initial.worker);
    return transaction(async (session) => {
      await lockWorker(initial.worker, session);
      const b = await Booking.findOneAndUpdate(
        { _id: id },
        { $inc: { revision: 1 } },
        { new: true, session },
      );
      return fn(b, session);
    });
  }
  async function finish(b, session) {
    await settlePayment(b, 'RELEASE_TO_WORKER', session);
    b.status = 'COMPLETED';
    b.completedAt = new Date();
    await b.save({ session });
    await reputation(b.worker, session);
  }
  async function ownDispute(id, user, session = null) {
    const d = await Dispute.findOne({
      _id: id,
      ...(user.role === 'ADMIN'
        ? {}
        : mongoose.trusted({
            $or: [{ customer: user._id }, { worker: user._id }],
          })),
    }).session(session);
    if (!d) throw new ApiError(404, 'NOT_FOUND', 'Dispute not found');
    return d;
  }
  return {
    async start(id, user) {
      return work(id, user, async (b, session) => {
        if (!same(b.worker, user._id))
          throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
        if (b.status !== 'CONFIRMED' || b.scheduledStart > new Date())
          throw new ApiError(
            409,
            'INVALID_TRANSITION',
            'Only a confirmed booking at or after its scheduled start can begin',
          );
        b.status = 'IN_PROGRESS';
        b.startedAt = new Date();
        await b.save({ session });
        return { booking: bookingDTO(b, user) };
      });
    },
    async complete(id, user, input) {
      return work(id, user, async (b, session) => {
        if (!same(b.worker, user._id))
          throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
        if (b.status !== 'IN_PROGRESS')
          throw new ApiError(
            409,
            'INVALID_TRANSITION',
            'Only an in-progress booking can be marked complete',
          );
        await media.ownedMany(
          input.evidence,
          user._id,
          'COMPLETION_EVIDENCE',
          session,
        );
        b.status = 'WORKER_MARKED_COMPLETED';
        b.workerCompletedAt = new Date();
        b.completionNotes = input.notes;
        b.completionEvidence = input.evidence;
        await b.save({ session });
        return { booking: bookingDTO(b, user) };
      });
    },
    async confirm(id, user) {
      return work(id, user, async (b, session) => {
        if (!same(b.customer, user._id))
          throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
        if (b.status !== 'WORKER_MARKED_COMPLETED')
          throw new ApiError(
            409,
            'INVALID_TRANSITION',
            'Worker must mark the job complete first',
          );
        await finish(b, session);
        return { booking: bookingDTO(b, user) };
      });
    },
    async dispute(id, user, input) {
      return work(id, user, async (b, session) => {
        if (!same(b.customer, user._id))
          throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
        if (
          !['CONFIRMED', 'IN_PROGRESS', 'WORKER_MARKED_COMPLETED'].includes(
            b.status,
          )
        )
          throw new ApiError(
            409,
            'INVALID_TRANSITION',
            'Only a paid active booking can be disputed',
          );
        await media.ownedMany(
          input.evidence,
          user._id,
          'DISPUTE_EVIDENCE',
          session,
        );
        const p = await Payment.findOne({
          _id: b.payment,
          status: 'HELD',
        }).session(session);
        if (!p)
          throw new ApiError(409, 'PAYMENT_NOT_HELD', 'Payment is not held');
        p.status = 'DISPUTED';
        p.disputedAt = new Date();
        await p.save({ session });
        b.status = 'DISPUTED';
        await b.save({ session });
        const [d] = await Dispute.create(
          [
            {
              ...input,
              booking: b._id,
              customer: b.customer,
              worker: b.worker,
            },
          ],
          { session },
        );
        return { dispute: disputeDTO(d) };
      });
    },
    async disputeOwn(id, user) {
      return {
        dispute: disputeDTO(await ownDispute(id, user), user.role === 'ADMIN'),
      };
    },
    async resolve(id, user, input) {
      const initial = await ownDispute(id, user);
      const b = await Booking.findById(initial.booking);
      await ensureWorkerLock(b.worker);
      return transaction(async (session) => {
        await lockWorker(b.worker, session);
        const d = await ownDispute(id, user, session);
        const booking = await Booking.findOneAndUpdate(
          { _id: d.booking },
          { $inc: { revision: 1 } },
          { new: true, session },
        );
        if (d.status !== 'OPEN' || booking.status !== 'DISPUTED')
          throw new ApiError(
            409,
            'INVALID_TRANSITION',
            'Dispute is already resolved',
          );
        if (input.decision === 'RELEASE_TO_WORKER')
          await finish(booking, session);
        else {
          await settlePayment(booking, 'REFUND_CUSTOMER', session);
          booking.status = 'CANCELLED';
          booking.cancelledAt = new Date();
          booking.cancellationReason = 'Dispute refund';
          await booking.save({ session });
        }
        d.status = 'RESOLVED';
        d.adminDecision = input.decision;
        d.decisionReason = input.reason;
        d.reviewedBy = user._id;
        d.reviewedAt = new Date();
        await d.save({ session });
        await recordAudit(
          user._id,
          'DISPUTE_RESOLVED',
          'Dispute',
          d._id,
          ['adminDecision', 'decisionReason'],
          session,
        );
        return { dispute: disputeDTO(d, true) };
      });
    },
    async review(id, user, input) {
      return work(id, user, async (b, session) => {
        if (!same(b.customer, user._id))
          throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
        if (b.status !== 'COMPLETED')
          throw new ApiError(
            409,
            'INVALID_TRANSITION',
            'Only completed SkillLink bookings can be reviewed',
          );
        if (await Review.exists({ booking: b._id }).session(session))
          throw new ApiError(
            409,
            'REVIEW_EXISTS',
            'This booking already has a review',
          );
        const [r] = await Review.create(
          [
            {
              ...input,
              booking: b._id,
              customer: b.customer,
              worker: b.worker,
            },
          ],
          { session },
        );
        await reputation(b.worker, session);
        return { review: reviewDTO(r) };
      });
    },
    async reviews(worker, page) {
      const f = { worker, moderationStatus: 'VISIBLE' };
      const [rows, total] = await Promise.all([
        Review.find(f)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page.page - 1) * page.limit)
          .limit(page.limit),
        Review.countDocuments(f),
      ]);
      return {
        reviews: rows.map(reviewDTO),
        pagination: pageMetadata(page.page, page.limit, total),
      };
    },
    async moderate(id, user, input) {
      const r = await Review.findById(id);
      if (!r) throw new ApiError(404, 'NOT_FOUND', 'Review not found');
      await ensureWorkerLock(r.worker);
      return transaction(async (session) => {
        await lockWorker(r.worker, session);
        const review = await Review.findById(id).session(session);
        review.moderationStatus = input.status;
        review.moderationReason = input.reason;
        review.moderatedBy = user._id;
        review.moderatedAt = new Date();
        await review.save({ session });
        await reputation(review.worker, session);
        await recordAudit(
          user._id,
          'REVIEW_MODERATED',
          'Review',
          review._id,
          ['moderationStatus', 'moderationReason'],
          session,
        );
        return { review: reviewDTO(review) };
      });
    },
    async evidence(id, mediaId, user) {
      const b = await participantBooking(id, user);
      const d = await Dispute.findOne({ booking: b._id });
      const ids = [...b.completionEvidence, ...(d?.evidence || [])].map(String);
      if (!ids.includes(mediaId))
        throw new ApiError(404, 'NOT_FOUND', 'Evidence not found');
      const asset = await MediaAsset.findById(mediaId).select(
        '+storageKey +resourceType +format +deliveryType',
      );
      if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Evidence not found');
      return media.link(asset, 60);
    },
  };
}
