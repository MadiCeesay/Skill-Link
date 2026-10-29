// Inspect first. Archival is scoped to exact locally generated demo workers.
import mongoose from 'mongoose';
import { readFile, writeFile } from 'node:fs/promises';
import { loadConfig } from '../src/config/env.js';
import { Booking } from '../src/modules/bookings/booking.model.js';
import { User } from '../src/modules/users/user.model.js';
import { transaction } from '../src/utils/transaction.js';
import { recordAudit } from '../src/modules/admin/audit.model.js';
import { operationsService } from '../src/modules/admin/operations.service.js';
const config = loadConfig();
let stage = 'connect';
let committed = false;
if (config.NODE_ENV !== 'development') throw Error('Development-only demo cleanup');
try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  stage = 'read-local-demo-identities';
  const accounts = await Promise.all(['accounts.json', 'manual-pass-accounts.json'].map(file => readFile(new URL('../.local-integration/' + file, import.meta.url), 'utf8').then(JSON.parse)));
  const emails = accounts.map(a => a.worker.email);
  if (emails.some(email => !/^(integration|manual)-worker-[a-z0-9]+@example\.test$/.test(email))) throw Error('Demo identity mismatch');
  const demos = await User.find({ email: mongoose.trusted({ $in: emails }), role: 'WORKER' }).select('_id').lean();
  const users = await User.find({}).select('firstName lastName role').lean();
  stage = 'identify-musa-booking';
  const byUser = new Map(users.map(u => [String(u._id), u]));
  const rows = await Booking.find({}).sort({ completedAt: -1, createdAt: -1 }).lean();
  const musa = rows.filter(b => b.status === 'COMPLETED' && /musa/i.test(byUser.get(String(b.worker))?.firstName || ''));
  if (!musa.length) throw Error('Cannot identify completed Musa booking');
  const keep = musa[0];
  const demoIds = new Set(demos.map(u => String(u._id)));
  const targets = rows.filter(b => demoIds.has(String(b.worker)) && String(b._id) !== String(keep._id));
  console.log(JSON.stringify({ mode: 'inspect-only', keep: String(keep._id), bookings: rows.map(b => ({ id: String(b._id), worker: [byUser.get(String(b.worker))?.firstName, byUser.get(String(b.worker))?.lastName].filter(Boolean).join(' '), status: b.status, amountBututs: b.agreedAmountBututs, completedAt: b.completedAt, action: String(b._id) === String(keep._id) ? 'preserve' : targets.includes(b) ? 'archive-demo' : 'unrelated-preserve' })) }, null, 2));
  if (process.argv.includes('--apply')) {
    stage = 'validate-cleanup-scope';
    const expectedKeep = process.argv.find(arg => arg.startsWith('--keep='))?.slice(7);
    if (expectedKeep !== String(keep._id)) throw Error('Preserved booking changed');
    if (targets.some(b => !['COMPLETED', 'CANCELLED'].includes(b.status) && !(b.status === 'AWAITING_PAYMENT' && b.reservationExpiresAt <= new Date())))
      throw Error('An active demo booking needs separate lifecycle handling');
    const admin = await User.findOne({ email: accounts[0].admin.email, role: 'ADMIN', accountStatus: 'ACTIVE' }).select('_id');
    if (!admin) throw Error('Cleanup administrator unavailable');
    const pending = targets.filter(b => !b.adminArchivedAt);
    const at = new Date();
    await writeFile(new URL('../.local-integration/booking-archive-backup-' + at.toISOString().replaceAll(':', '-') + '.json', import.meta.url),
      JSON.stringify({ preservedBooking: keep, archivedBookings: pending, createdAt: at }, null, 2), { flag: 'wx' });
    stage = 'archive-demo-bookings';
    await transaction(async session => {
      for (const b of pending) {
        const reason = 'User requested clearing generated demo bookings from admin lists and overview; preserve Musa latest completed booking and retain all historical financial records.';
        const changed = await Booking.updateOne({ _id: b._id, worker: b.worker, status: b.status, adminArchivedAt: null },
          { $set: { adminArchivedAt: at, adminArchiveReason: reason } }, { session });
        if (changed.modifiedCount !== 1) throw Error('Demo booking changed during cleanup');
        await recordAudit(admin._id, 'DEMO_BOOKING_ARCHIVED', 'Booking', b._id, ['adminArchivedAt', 'adminArchiveReason'], session, reason);
      }
    });
    committed = true;
    stage = 'verify-preserved-booking';
    if (JSON.stringify(await Booking.findById(keep._id).lean()) !== JSON.stringify(keep)) throw Error('Preserved booking differs');
    const service = operationsService();
    const visible = await service.bookings({ page: 1, limit: 50 });
    const metrics = await service.metrics();
    if (visible.items.length !== 1 || visible.items[0].id !== expectedKeep || metrics.totalBookings !== 1)
      throw Error('Unexpected remaining admin booking records');
    console.log(JSON.stringify({ archivedDemoBookings: pending.length, preservedBooking: expectedKeep, visibleBookings: metrics.totalBookings,
      completedBookings: metrics.completedBookings, simulatedVolumeBututs: metrics.simulatedTransactionVolumeBututs,
      simulatedRevenueBututs: metrics.simulatedPlatformRevenueBututs, simulatedRefundsBututs: metrics.simulatedRefundsBututs,
      financialHistoryPreserved: true, at }));
  }
  if (process.argv.includes('--check-api')) {
    stage = 'verify-running-admin-api';
    const base = `http://localhost:${config.PORT}/api`;
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: accounts[0].admin.email, password: accounts[0].admin.password }) });
    if (!login.ok) throw Error('Admin verification sign-in failed');
    const token = (await login.json()).data.accessToken;
    try {
      const headers = { Authorization: 'Bearer ' + token };
      const bookings = await fetch(base + '/admin/bookings', { headers });
      const metrics = await fetch(base + '/admin/metrics', { headers });
      if (!bookings.ok || !metrics.ok) throw Error('Admin verification read failed');
      const visible = (await bookings.json()).data, overview = (await metrics.json()).data;
      console.log(JSON.stringify({ runningAdminApi: { visibleBookings: visible.pagination.total,
        preservedBookingVisible: visible.items.some(b => b.id === String(keep._id)),
        overviewBookings: overview.totalBookings, simulatedVolumeBututs: overview.simulatedTransactionVolumeBututs } }));
    } finally { await fetch(base + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}); }
  }
} catch (error) {
  console.error(JSON.stringify({ failureStage: stage, errorType: error.name, code: error.code, noChanges: !committed }));
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
