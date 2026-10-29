// Read-only by default. Excludes only verified generated identities from metrics.
import mongoose from 'mongoose';
import { readFile, writeFile } from 'node:fs/promises';
import { loadConfig } from '../src/config/env.js';
import { User } from '../src/modules/users/user.model.js';
import { Booking } from '../src/modules/bookings/booking.model.js';
import { operationsService } from '../src/modules/admin/operations.service.js';
import { recordAudit } from '../src/modules/admin/audit.model.js';
import { transaction } from '../src/utils/transaction.js';
const config = loadConfig();
let committed = false;
let stage = 'connect';
if (config.NODE_ENV !== 'development') throw Error('Development-only cleanup');
try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  stage = 'validate-local-identities';
  const files = await Promise.all(['accounts.json', 'manual-pass-accounts.json'].map(file => readFile(new URL('../.local-integration/' + file, import.meta.url), 'utf8').then(JSON.parse)));
  // Keep the administrator used to operate the application in the real counts.
  const emails = [...new Set(files.flatMap(file => ['customer', 'worker'].map(role => file[role]?.email).filter(Boolean)))];
  if (!emails.length || emails.some(email => !/^(integration|manual)-(admin|customer|worker)-[a-z0-9]+@example\.test$/.test(email))) throw Error('Unexpected local demo identities');
  stage = 'check-preserved-booking';
  const keep = await Booking.findById('6adff764aa0ddab68ab1e1e0').lean();
  if (!keep || keep.status !== 'COMPLETED' || keep.adminArchivedAt) throw Error('Preserved booking check failed');
  const musa = await User.findById(keep.worker).select('firstName lastName').lean();
  if (!/musa/i.test(musa?.firstName || '')) throw Error('Preserved professional check failed');
  const protectedIds = new Set([keep.worker, keep.customer].map(String));
  const targets = (await User.find({ email: mongoose.trusted({ $in: emails }) }).select('_id firstName lastName role adminMetricsExcludedAt').lean()).filter(user => !protectedIds.has(String(user._id)));
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'exclude-demo-metrics' : 'inspect-only', selected: targets.map(u => ({ id: String(u._id), name: u.firstName + ' ' + u.lastName, role: u.role, alreadyExcluded: Boolean(u.adminMetricsExcludedAt) })), preservedBooking: String(keep._id) }));
  if (process.argv.includes('--apply')) {
    const admin = await User.findOne({ email: files[0].admin.email, role: 'ADMIN', accountStatus: 'ACTIVE' }).select('_id');
    if (!admin) throw Error('Administrator unavailable');
    const pending = targets.filter(u => !u.adminMetricsExcludedAt), at = new Date();
    await writeFile(new URL('../.local-integration/demo-account-metrics-backup-' + at.toISOString().replaceAll(':', '-') + '.json', import.meta.url), JSON.stringify({ users: pending, at }, null, 2), { flag: 'wx' });
    await transaction(async session => {
      for (const user of pending) {
        const changed = await User.updateOne({ _id: user._id, adminMetricsExcludedAt: null }, { $set: { adminMetricsExcludedAt: at } }, { session });
        if (changed.modifiedCount !== 1) throw Error('Demo identity changed during cleanup');
        await recordAudit(admin._id, 'DEMO_ACCOUNT_EXCLUDED_FROM_METRICS', 'User', user._id, ['adminMetricsExcludedAt'], session,
          'Owner requested excluding generated demo accounts from admin overview counts. Keep accounts, authentication and historical records intact.');
      }
    });
    committed = true;
    if (JSON.stringify(await Booking.findById(keep._id).lean()) !== JSON.stringify(keep)) throw Error('Preserved booking changed');
    for (const id of protectedIds) if ((await User.findById(id)).adminMetricsExcludedAt) throw Error('Protected participant excluded');
    const metrics = await operationsService().metrics();
    console.log(JSON.stringify({ excludedDemoAccounts: pending.length, people: metrics.totalUsers, approvedProfessionals: metrics.verifiedWorkers,
      completedBookings: metrics.completedBookings, accountsAndHistoryRetained: true }));
  }
  if (process.argv.includes('--check-api')) {
    const base = `http://localhost:${config.PORT}/api`;
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: files[0].admin.email, password: files[0].admin.password }) });
    if (!response.ok) throw Error('Verification sign-in failed');
    const token = (await response.json()).data.accessToken;
    try {
      const result = await fetch(base + '/admin/metrics', { headers: { Authorization: 'Bearer ' + token } });
      if (!result.ok) throw Error('Verification metrics read failed');
      const m = (await result.json()).data;
      console.log(JSON.stringify({ liveOverview: { people: m.totalUsers, approvedProfessionals: m.verifiedWorkers, completedBookings: m.completedBookings } }));
    } finally { await fetch(base + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}); }
  }
} catch (error) {
  console.error(JSON.stringify({ cleanupFailed: true, stage, errorType: error.name, noDataChanges: !committed }));
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
