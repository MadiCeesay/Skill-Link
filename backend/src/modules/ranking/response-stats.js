import mongoose from 'mongoose';
import { DirectProposal } from '../bookings/proposal.model.js';

// Only recent behaviour counts towards a worker's responsiveness.
export const RESPONSE_WINDOW_DAYS = 180;

/**
 * How each worker has handled direct requests from customers in the last 180 days.
 *
 * - received: requests the worker had the chance to answer
 * - responded: requests the worker accepted, declined or quoted
 * - averageMinutes: average time from request to first answer
 *
 * Requests cancelled by the customer before any answer, and requests that are still
 * open, are left out: the worker cannot be blamed for them yet.
 * Requests answered before `respondedAt` existed fall back to `updatedAt`.
 *
 * @param {Array<string|mongoose.Types.ObjectId>} workerIds
 * @param {Date} now
 * @returns {Promise<Map<string, {received:number, responded:number, averageMinutes:number|null}>>}
 */
export async function responseStatsFor(workerIds, now = new Date()) {
  const stats = new Map();
  if (!workerIds.length) return stats;
  const since = new Date(now.getTime() - RESPONSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const answered = ['ACCEPTED', 'REJECTED', 'QUOTED'];
  const rows = await DirectProposal.aggregate([
    { $match: { worker: { $in: workerIds.map(id => new mongoose.Types.ObjectId(String(id))) }, createdAt: { $gte: since } } },
    { $set: {
      answeredAt: { $ifNull: ['$respondedAt', { $cond: [{ $in: ['$status', answered] }, '$updatedAt', null] }] },
      closedWithoutAnswer: { $or: [
        { $eq: ['$status', 'EXPIRED'] },
        { $and: [{ $in: ['$status', ['PENDING']] }, { $lte: ['$expiresAt', now] }] },
      ] },
    } },
    // Keep answered requests and requests the worker let expire.
    { $match: { $or: [{ answeredAt: { $ne: null } }, { closedWithoutAnswer: true }] } },
    { $group: {
      _id: '$worker',
      received: { $sum: 1 },
      responded: { $sum: { $cond: [{ $ne: ['$answeredAt', null] }, 1, 0] } },
      averageMs: { $avg: { $cond: [{ $ne: ['$answeredAt', null] }, { $subtract: ['$answeredAt', '$createdAt'] }, null] } },
    } },
  ]).option({ maxTimeMS: 5000 });
  for (const row of rows)
    stats.set(String(row._id), {
      received: row.received,
      responded: row.responded,
      averageMinutes: row.averageMs === null || row.averageMs === undefined ? null : Math.max(0, row.averageMs / 60000),
    });
  return stats;
}
