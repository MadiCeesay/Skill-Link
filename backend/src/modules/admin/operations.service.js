import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { Session } from '../auth/session.model.js';
import { WorkerProfile } from '../workers/worker.model.js';
import { Verification } from '../verifications/verification.model.js';
import { JobRequest } from '../jobRequests/job.model.js';
import { Booking } from '../bookings/booking.model.js';
import { Payment, FinancialLedgerEntry } from '../payments/payment.model.js';
import { Review } from '../reviews/review.model.js';
import { Dispute } from '../disputes/dispute.model.js';
import { recordAudit } from './audit.model.js';
import { bookingDTO } from '../bookings/booking.serializer.js';
import { disputeDTO, reviewDTO } from '../bookings/lifecycle.serializer.js';
import { paymentDTO, ledgerDTO } from '../payments/payment.serializer.js';
import { transaction } from '../../utils/transaction.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageMetadata } from '../discovery/discovery.service.js';
const userDTO = (u) => ({
  id: String(u._id),
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
  accountStatus: u.accountStatus,
  createdAt: u.createdAt,
});
async function list(Model, filter, page, dto) {
  const [rows, total] = await Promise.all([
    Model.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    Model.countDocuments(filter),
  ]);
  return {
    items: rows.map(dto),
    pagination: pageMetadata(page.page, page.limit, total),
  };
}
// Enrich admin-only financial views in batches; retain immutable reference IDs.
async function financialPeople(rows) {
  const bookings = await Booking.find({ _id: mongoose.trusted({ $in: rows.map(r => r.booking) }) })
    .select('customer worker').lean();
  const byBooking = new Map(bookings.map(b => [String(b._id), b]));
  const people = rows.map(r => ({ customer: r.customer || byBooking.get(r.booking)?.customer,
    worker: r.worker || byBooking.get(r.booking)?.worker }));
  const ids = [...new Set(people.flatMap(p => [p.customer, p.worker]).filter(Boolean).map(String))];
  const users = await User.find({ _id: mongoose.trusted({ $in: ids }) }).select('firstName lastName').lean();
  const byUser = new Map(users.map(u => [String(u._id), { id: String(u._id), firstName: u.firstName, lastName: u.lastName }]));
  return rows.map((row, i) => ({ ...row,
    customerSummary: byUser.get(String(people[i].customer)) || null,
    workerSummary: byUser.get(String(people[i].worker)) || null,
  }));
}
export function operationsService() {
  async function archivedBookings() {
    return Booking.find({ adminArchivedAt: mongoose.trusted({ $ne: null }) }).select('_id jobRequest').lean();
  }
  async function financialFilter() {
    return { booking: mongoose.trusted({ $nin: (await archivedBookings()).map(b => b._id) }) };
  }
  return {
    async users(page) {
      return list(User, {}, page, userDTO);
    },
    async status(id, admin, input) {
      return transaction(async (session) => {
        const user = await User.findById(id).session(session);
        if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
        if (user.role === 'ADMIN')
          throw new ApiError(
            403,
            'ADMIN_PROTECTED',
            'Administrator accounts cannot be suspended through marketplace operations',
          );
        user.accountStatus = input.status;
        await User.updateOne(
          { _id: id },
          { $set: { accountStatus: input.status }, $inc: { tokenVersion: 1 } },
          { session },
        );
        await Session.updateMany(
          { user: id, revokedAt: null },
          { $set: { revokedAt: new Date() } },
          { session },
        );
        await recordAudit(
          admin._id,
          'USER_' + input.status,
          'User',
          user._id,
          ['accountStatus'],
          session,
          input.reason,
        );
        return { user: userDTO(user) };
      });
    },
    async bookings(page) {
      return list(Booking, { adminArchivedAt: null }, page, (b) => bookingDTO(b, { role: 'ADMIN' }));
    },
    async booking(id) {
      const b = await Booking.findById(id);
      if (!b) throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
      return { booking: bookingDTO(b, { role: 'ADMIN' }) };
    },
    async payments(page) {
      const result = await list(Payment, await financialFilter(), page, paymentDTO);
      return { ...result, items: await financialPeople(result.items) };
    },
    async payment(id) {
      const p = await Payment.findById(id);
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
      return {
        payment: (await financialPeople([paymentDTO(p)]))[0],
        entries: (
          await FinancialLedgerEntry.find({ payment: id }).sort({
            createdAt: 1,
            _id: 1,
          })
        ).map(ledgerDTO),
      };
    },
    async ledger(page) {
      const result = await list(FinancialLedgerEntry, await financialFilter(), page, ledgerDTO);
      return { ...result, items: await financialPeople(result.items) };
    },
    async disputes(page) {
      return list(Dispute, await financialFilter(), page, (d) => disputeDTO(d, true));
    },
    async reviews(page) {
      return list(Review, await financialFilter(), page, (r) => ({
        ...reviewDTO(r),
        moderationReason: r.moderationReason,
        moderatedAt: r.moderatedAt,
      }));
    },
    async metrics() {
      const now = new Date();
      const archived = await archivedBookings();
      const bookingIds = archived.map(b => b._id);
      const jobIds = archived.map(b => b.jobRequest).filter(Boolean);
      const bookingFilter = { booking: mongoose.trusted({ $nin: bookingIds }) };
      const excludedUsers = await User.find({ adminMetricsExcludedAt: mongoose.trusted({ $ne: null }) }).select('_id').lean();
      const verificationFilter = { worker: mongoose.trusted({ $nin: excludedUsers.map(u => u._id) }) };
      const [
        users,
        bookings,
        verifiedWorkers,
        pendingVerifications,
        openJobRequests,
        acceptedJobs,
        reviews,
        pendingDisputes,
        money,
        expiredReservations,
      ] = await Promise.all([
        User.aggregate([{ $match: { adminMetricsExcludedAt: null } }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
        Booking.aggregate([
          { $match: { adminArchivedAt: null } },
          {
            $group: {
              _id: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'AWAITING_PAYMENT'] },
                      { $lte: ['$reservationExpiresAt', now] },
                    ],
                  },
                  'CANCELLED',
                  '$status',
                ],
              },
              count: { $sum: 1 },
            },
          },
        ]),
        Verification.countDocuments({ status: 'APPROVED', ...verificationFilter }),
        Verification.countDocuments({ status: 'PENDING', ...verificationFilter }),
        JobRequest.countDocuments({
          _id: mongoose.trusted({ $nin: jobIds }),
          status: 'OPEN',
          expiresAt: mongoose.trusted({ $gt: now }),
        }),
        JobRequest.countDocuments({ status: 'QUOTE_ACCEPTED', _id: mongoose.trusted({ $nin: jobIds }) }),
        Review.countDocuments(bookingFilter),
        Dispute.countDocuments({ status: 'OPEN', ...bookingFilter }),
        Payment.aggregate([
          { $match: { booking: { $nin: bookingIds } } },
          {
            $group: {
              _id: null,
              volume: {
                $sum: {
                  $cond: [
                    { $ne: [{ $ifNull: ['$paidAt', null] }, null] },
                    { $toDecimal: '$amountBututs' },
                    { $toDecimal: 0 },
                  ],
                },
              },
              revenue: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', 'RELEASED'] },
                    { $toDecimal: '$platformFeeBututs' },
                    { $toDecimal: 0 },
                  ],
                },
              },
              refunds: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', 'REFUNDED'] },
                    { $toDecimal: '$amountBututs' },
                    { $toDecimal: 0 },
                  ],
                },
              },
            },
          },
        ]),
        Booking.countDocuments({
          adminArchivedAt: null,
          status: 'AWAITING_PAYMENT',
          reservationExpiresAt: mongoose.trusted({ $lte: now }),
        }),
      ]);
      const by = (rows, key) => rows.find((r) => r._id === key)?.count || 0;
      return {
        totalUsers: users.reduce((s, r) => s + r.count, 0),
        customers: by(users, 'CUSTOMER'),
        workers: by(users, 'WORKER'),
        verifiedWorkers,
        pendingVerifications,
        openJobRequests,
        acceptedJobs,
        totalBookings: bookings.reduce((s, r) => s + r.count, 0),
        confirmedBookings: by(bookings, 'CONFIRMED'),
        completedBookings: by(bookings, 'COMPLETED'),
        cancelledBookings: by(bookings, 'CANCELLED'),
        disputedBookings: by(bookings, 'DISPUTED'),
        reviews,
        pendingDisputes,
        expiredReservations,
        simulated: true,
        currency: 'GMD',
        simulatedTransactionVolumeBututs: money[0]?.volume?.toString() || '0',
        simulatedPlatformRevenueBututs: money[0]?.revenue?.toString() || '0',
        simulatedRefundsBututs: money[0]?.refunds?.toString() || '0',
      };
    },
  };
}
