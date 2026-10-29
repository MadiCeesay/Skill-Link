import mongoose from 'mongoose';
import { Availability, WorkerScheduleLock } from './availability.model.js';
import { Booking } from '../bookings/booking.model.js';
import { WorkerProfile } from '../workers/worker.model.js';
import { transaction } from '../../utils/transaction.js';
import { ApiError } from '../../utils/ApiError.js';
export async function ensureWorkerLock(worker) {
  // The stable unique worker row exists outside the transaction; concurrent initializers are safe.
  await WorkerScheduleLock.updateOne(
    { _id: worker },
    { $setOnInsert: { revision: 0 } },
    { upsert: true },
  ).catch((e) => {
    if (e.code !== 11000) throw e;
  });
}
export async function lockWorker(worker, session) {
  await WorkerScheduleLock.findOneAndUpdate(
    { _id: worker },
    { $inc: { revision: 1 } },
    { session, new: true },
  );
}
export function withinAvailability(a, start, end) {
  // Africa/Banjul is UTC+00 year-round; Intl validates the intended civil day explicitly.
  const parts = (d) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Banjul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
  const x = parts(start),
    y = parts(end);
  const date = (p) => p.year + '-' + p.month + '-' + p.day;
  if (
    !a ||
    date(x) !== date(y) ||
    start >= end ||
    start.getUTCSeconds() ||
    end.getUTCSeconds() ||
    start.getUTCMilliseconds() ||
    end.getUTCMilliseconds()
  )
    return false;
  if (
    a.blockedDates.includes(date(x)) ||
    a.timeOff.some((t) => start < t.end && end > t.start)
  )
    return false;
  const day = new Date(date(x) + 'T12:00:00Z').getUTCDay(),
    s = x.hour + ':' + x.minute,
    e = y.hour + ':' + y.minute;
  return a.weekly.some((i) => i.day === day && s >= i.start && e <= i.end);
}
export const slotBlocking = (now) => ({
  $or: [
    {
      status: mongoose.trusted({
        $in: [
          'CONFIRMED',
          'IN_PROGRESS',
          'WORKER_MARKED_COMPLETED',
          'DISPUTED',
        ],
      }),
    },
    {
      status: 'AWAITING_PAYMENT',
      reservationExpiresAt: mongoose.trusted({ $gt: now }),
    },
  ],
});
export const availabilityDTO = (a) => ({
  timezone: 'Africa/Banjul',
  weekly:
    a?.weekly?.map((i) => ({ day: i.day, start: i.start, end: i.end })) || [],
  blockedDates: a?.blockedDates || [],
  timeOff: a?.timeOff?.map((i) => ({ start: i.start, end: i.end })) || [],
});
export function availabilityService() {
  return {
    async own(worker) {
      return {
        availability: availabilityDTO(await Availability.findOne({ worker })),
      };
    },
    async update(worker, input) {
      await ensureWorkerLock(worker);
      return transaction(async (session) => {
        await lockWorker(worker, session);
        const bookings = await Booking.find({
          worker,
          ...slotBlocking(new Date()),
        })
          .setOptions({ sanitizeFilter: false })
          .session(session);
        if (
          bookings.some(
            (b) =>
              b.scheduledEnd > new Date() &&
              !withinAvailability(input, b.scheduledStart, b.scheduledEnd),
          )
        )
          throw new ApiError(
            409,
            'ACTIVE_BOOKING_CONFLICT',
            'Availability cannot exclude an existing reserved or active booking',
          );
        const a = await Availability.findOneAndUpdate(
          { worker },
          { $set: input },
          { new: true, upsert: true, runValidators: true, session },
        );
        return { availability: availabilityDTO(a) };
      });
    },
    async availableNow(worker, input) {
      const p = await WorkerProfile.findOneAndUpdate(
        { user: worker },
        { $set: input },
        { new: true },
      );
      if (!p)
        throw new ApiError(404, 'NOT_FOUND', 'Professional profile not found');
      return { availableNow: p.availableNow };
    },
  };
}
