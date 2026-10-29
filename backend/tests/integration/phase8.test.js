import { Notification } from '../../src/modules/notifications/notification.model.js';
import { Dispute } from '../../src/modules/disputes/dispute.model.js';
import { Review } from '../../src/modules/reviews/review.model.js';
import {
  Payment,
  PaymentAttempt,
  FinancialLedgerEntry,
} from '../../src/modules/payments/payment.model.js';
import { breakdown } from '../../src/modules/payments/payment.service.js';
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { MongoMemoryReplSet } from '../helpers/mongo-memory.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import {
  connectDatabase,
  disconnectDatabase,
  ensureIndexes,
} from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { WorkerProfile } from '../../src/modules/workers/worker.model.js';
import { Category } from '../../src/modules/catalog/category.model.js';
import { Service } from '../../src/modules/catalog/service.model.js';
import { MediaAsset } from '../../src/modules/media/media.model.js';
import { Verification } from '../../src/modules/verifications/verification.model.js';
import { JobRequest } from '../../src/modules/jobRequests/job.model.js';
import { Quote } from '../../src/modules/quotes/quote.model.js';
import {
  Availability,
  WorkerScheduleLock,
} from '../../src/modules/availability/availability.model.js';
import { Booking } from '../../src/modules/bookings/booking.model.js';
import { DirectProposal } from '../../src/modules/bookings/proposal.model.js';
import { AuditEvent } from '../../src/modules/admin/audit.model.js';
import { FakeMediaProvider } from '../helpers/fake-media.provider.js';
let mongo,
  app,
  fake,
  worker,
  second,
  unverified,
  customer,
  stranger,
  admin,
  category,
  auto,
  service,
  plumbing,
  mechanic,
  png;
const unknown = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const models = [
  Notification,
  Dispute,
  Review,
  Payment,
  PaymentAttempt,
  FinancialLedgerEntry,
  Availability,
  WorkerScheduleLock,
  Booking,
  DirectProposal,
  WorkerProfile,
  Category,
  Service,
  MediaAsset,
  Verification,
  JobRequest,
  Quote,
  AuditEvent,
];
const api = (method, path, actor) => {
  const r = request(app)[method]('/api' + path);
  return actor ? r.set('Authorization', 'Bearer ' + actor.token) : r;
};
const jobInput = () => ({
  service: service.id,
  title: 'Repair a damaged electrical socket',
  description:
    'Please inspect and repair a damaged electrical socket in my room.',
  serviceArea: { name: 'Brikama', region: 'West Coast', country: 'GM' },
  location: { type: 'Point', coordinates: [-16.651, 13.271] },
  privateAddress: 'Private home address, house 123',
  budget: { type: 'OPEN_TO_QUOTES' },
});
const proposal = (extra) => ({
  proposedAmountBututs: 45000,
  message: 'I can inspect and repair the socket.',
  estimatedDurationMinutes: 90,
  ...extra,
});
async function job(extra = {}, owner = customer) {
  const r = await api('post', '/job-requests', owner).send({
    ...jobInput(),
    ...extra,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data.jobRequest;
}
async function quote(j, actor = worker, extra = {}) {
  const r = await api('post', '/job-requests/' + j.id + '/quotes', actor).send(
    proposal(extra),
  );
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data.quote;
}
const accept = (q, actor = customer) =>
  api('post', '/quotes/' + q.id + '/accept', actor);
async function upload(
  actor = customer,
  purpose = 'JOB_ATTACHMENT',
  buffer = png,
  contentType = 'image/png',
) {
  return api('post', '/media/' + purpose, actor).attach('file', buffer, {
    filename: 'image.png',
    contentType,
  });
}
async function fixtureUser(role, index) {
  const user = await User.create({
    firstName: role + index,
    lastName: 'Tester',
    email: 'phase3-' + index + '@example.test',
    phoneNumber: '+220710000' + index,
    password: 'Test-password123',
    role,
  });
  const r = await api('post', '/auth/login').send({
    email: user.email,
    password: 'Test-password123',
  });
  expect(r.status).toBe(200);
  return { id: user.id, token: r.body.data.accessToken };
}
async function profile(actor, coordinates, approved, price) {
  const p = await WorkerProfile.create({
    user: actor.id,
    professionTitle: 'Electrician',
    bio: 'Residential wiring and electrical repairs throughout the local service area.',
    services: [service._id],
    skills: ['Solar installation'],
    serviceAreas: [{ name: 'Brikama', region: 'West Coast', country: 'GM' }],
    primaryLocation: { type: 'Point', coordinates },
    serviceRadiusKm: 25,
    profileVisibility: 'PUBLIC',
    availableNow: actor.id === worker.id,
    pricing: [{ service: service._id, type: 'HOURLY', amountBututs: price }],
  });
  if (approved) {
    const asset = await MediaAsset.create({
      owner: actor.id,
      purpose: 'IDENTITY_DOCUMENT',
      provider: 'fake',
      storageKey: 'identity/' + actor.id,
      resourceType: 'image',
      format: 'png',
      deliveryType: 'authenticated',
      mimeType: 'image/png',
      bytes: 100,
    });
    await Verification.create({
      worker: actor.id,
      identityDocument: asset._id,
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: admin.id,
    });
  }
  return p;
}
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const config = loadConfig({
    NODE_ENV: 'test',
    MONGODB_URI: mongo.getUri(),
    JWT_ACCESS_SECRET: 'phase3-access-test-secret-not-production-123',
    JWT_REFRESH_SECRET: 'phase3-refresh-test-secret-not-production-456',
    FRONTEND_ORIGIN: 'http://localhost:5173',
  });
  fake = new FakeMediaProvider();
  app = createApp(config, {
    mediaProvider: fake,
    uploadLimit: 10000,
    authLimit: 10000,
    globalLimit: 10000,
    paymentLimit: 10000,
    marketWriteLimit: 10000,
  });
  await connectDatabase(config.MONGODB_URI);
  await ensureIndexes();
  worker = await fixtureUser('WORKER', 1);
  second = await fixtureUser('WORKER', 2);
  unverified = await fixtureUser('WORKER', 3);
  customer = await fixtureUser('CUSTOMER', 4);
  stranger = await fixtureUser('CUSTOMER', 5);
  admin = await fixtureUser('ADMIN', 6);
  png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#abcdef' },
  })
    .png()
    .toBuffer();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(models.map((m) => m.deleteMany({})));
  await User.updateMany({}, { $set: { accountStatus: 'ACTIVE' }, $unset: { adminMetricsExcludedAt: 1 } });
  fake.assets.clear();
  category = await Category.create({
    name: 'Home',
    nameKey: 'home',
    slug: 'home',
  });
  auto = await Category.create({
    name: 'Automotive',
    nameKey: 'automotive',
    slug: 'automotive',
  });
  service = await Service.create({
    category: category._id,
    name: 'Electrician',
    nameKey: 'electrician',
    slug: 'electrician',
  });
  plumbing = await Service.create({
    category: category._id,
    name: 'Plumber',
    nameKey: 'plumber',
    slug: 'plumber',
  });
  mechanic = await Service.create({
    category: auto._id,
    name: 'Mechanic',
    nameKey: 'mechanic',
    slug: 'mechanic',
  });
  await profile(worker, [-16.65, 13.27], true, 15000);
  await profile(second, [-16.66, 13.28], true, 20000);
  await profile(unverified, [-16.655, 13.275], false, 17000);
  await Availability.create({
    worker: worker.id,
    weekly: Array.from({ length: 7 }, (_, day) => ({
      day,
      start: '08:00',
      end: '20:00',
    })),
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await disconnectDatabase();
  await mongo?.stop();
});

const start = () => {
  const d = new Date(Date.now() + 3 * 86400000);
  d.setUTCHours(10, 0, 0, 0);
  return d;
};
const slot = (hour = 10, end = 11) => {
  const s = start(),
    e = start();
  s.setUTCHours(Math.floor(hour), Math.round((hour % 1) * 60));
  e.setUTCHours(Math.floor(end), Math.round((end % 1) * 60));
  return { scheduledStart: s.toISOString(), scheduledEnd: e.toISOString() };
};
const direct = (extra = {}) => ({
  ...jobInput(),
  title: undefined,
  budget: undefined,
  worker: worker.id,
  agreedAmountBututs: 45000,
  ...slot(),
  ...extra,
});
async function pending(extra = {}) {
  const r = await api('post', '/direct-proposals', customer).send(
    direct(extra),
  );
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data.proposal;
}
async function reserve(extra = {}) {
  const p = await pending(extra);
  const r = await api(
    'post',
    '/direct-proposals/' + p.id + '/accept',
    worker,
  ).send({});
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return Booking.findById(r.body.data.proposal.booking);
}

const checkout = (
  b,
  actor = customer,
  outcome = 'SUCCESS',
  key = 'checkout-key-1',
) =>
  api('post', '/payments/bookings/' + b.id + '/checkout', actor).send({
    outcome,
    idempotencyKey: key,
  });
async function paid() {
  const b = await reserve();
  expect((await checkout(b)).status).toBe(200);
  await Booking.updateOne(
    { _id: b._id },
    { $set: { scheduledStart: new Date(Date.now() - 60000) } },
  );
  return b;
}
async function started() {
  const b = await paid();
  expect(
    (await api('post', '/bookings/' + b.id + '/start', worker).send({})).status,
  ).toBe(200);
  return b;
}
async function marked() {
  const b = await started();
  expect(
    (
      await api('post', '/bookings/' + b.id + '/complete', worker).send({
        notes: 'Repair finished safely',
      })
    ).status,
  ).toBe(200);
  return b;
}
async function completed() {
  const b = await marked();
  expect(
    (
      await api(
        'post',
        '/bookings/' + b.id + '/confirm-completion',
        customer,
      ).send({})
    ).status,
  ).toBe(200);
  return b;
}
const disputeInput = () => ({
  reason: 'Work quality',
  description: 'The fixture still does not function properly after the repair.',
});
async function disputed() {
  const b = await marked(),
    r = await api('post', '/bookings/' + b.id + '/dispute', customer).send(
      disputeInput(),
    );
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { b, d: r.body.data.dispute };
}
beforeEach(async () => {
  const r = await api('post', '/auth/login').send({
    email: 'phase3-1@example.test',
    password: 'Test-password123',
  });
  expect(r.status).toBe(200);
  worker.token = r.body.data.accessToken;
});
describe('Phase 8 notifications and admin operations', () => {
  it('notifies only intended recipients with safe payloads', async () => {
    const p = await pending();
    const r = await api('get', '/notifications/me', worker);
    expect(r.status).toBe(200);
    expect(
      r.body.data.notifications.some((n) => n.type === 'PROPOSAL_PENDING'),
    ).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain('Private home');
    expect(JSON.stringify(r.body)).not.toContain('location');
    expect(
      (await api('get', '/notifications/me', stranger)).body.data.notifications,
    ).toHaveLength(0);
  });
  it('protects recipient ownership and supports read and unread count', async () => {
    await pending();
    const n = await Notification.findOne({ recipient: worker.id });
    expect(
      (await api('post', '/notifications/' + n.id + '/read', stranger).send({}))
        .status,
    ).toBe(404);
    expect(
      (await api('get', '/notifications/unread-count', worker)).body.data
        .unreadCount,
    ).toBe(1);
    expect(
      (await api('post', '/notifications/' + n.id + '/read', worker).send({}))
        .status,
    ).toBe(200);
    expect(
      (await api('get', '/notifications/unread-count', worker)).body.data
        .unreadCount,
    ).toBe(0);
  });
  it('supports paginated notification history and read all', async () => {
    await pending();
    await pending(slot(12, 13));
    expect(
      (await api('get', '/notifications/me?limit=1', worker)).body.data
        .notifications,
    ).toHaveLength(1);
    expect((await api('get', '/notifications/me?limit=0', worker)).status).toBe(
      400,
    );
    expect(
      (await api('post', '/notifications/read-all', worker).send({})).status,
    ).toBe(200);
    expect(
      (await api('get', '/notifications/unread-count', worker)).body.data
        .unreadCount,
    ).toBe(0);
  });
  it('does not duplicate notifications on idempotent checkout', async () => {
    const b = await reserve();
    await checkout(b);
    const count = await Notification.countDocuments();
    await checkout(b);
    expect(await Notification.countDocuments()).toBe(count);
  });
  it('notification persistence failure does not undo a committed marketplace action', async () => {
    vi.spyOn(Notification, 'findOneAndUpdate').mockRejectedValueOnce(
      Error('test notification failure'),
    );
    const p = await pending();
    expect(await DirectProposal.exists({ _id: p.id })).toBeTruthy();
  });
  it('omits flagged demo accounts and approvals only from overview counts', async () => {
    const before = (await api('get', '/admin/metrics', admin)).body.data;
    const userCount = await User.countDocuments();
    await User.updateOne({ _id: worker.id }, { $set: { adminMetricsExcludedAt: new Date() } });
    const after = (await api('get', '/admin/metrics', admin)).body.data;
    expect(after.totalUsers).toBe(before.totalUsers - 1);
    expect(after.workers).toBe(before.workers - 1);
    expect(after.verifiedWorkers).toBe(before.verifiedWorkers - 1);
    expect(after.customers).toBe(before.customers);
    expect(await User.countDocuments()).toBe(userCount);
    expect((await api('get', '/availability/me', worker)).status).toBe(200);
    const account = (await api('get', '/admin/users', admin)).body.data.items.find(u => u.id === worker.id);
    expect(account).toBeDefined();
    expect(account.accountStatus).toBe('ACTIVE');
  });
  it('admin metrics use real database counts and simulated financial aggregates', async () => {
    const b = await completed();
    const r = await api('get', '/admin/metrics', admin);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.totalUsers).toBe(6);
    expect(r.body.data.completedBookings).toBe(1);
    expect(r.body.data.simulatedTransactionVolumeBututs).toBe('45000');
    expect(r.body.data.simulatedPlatformRevenueBututs).toBe('4500');
  });
  it.each([
    '/admin/metrics',
    '/admin/health',
    '/admin/users',
    '/admin/bookings',
    '/admin/payments',
    '/admin/ledger',
    '/admin/disputes',
    '/admin/reviews',
  ])('protects admin operation %s', async (path) => {
    expect((await api('get', path, customer)).status).toBe(403);
    expect((await api('get', path, worker)).status).toBe(403);
    expect((await api('get', path, admin)).status).toBe(200);
  });
  it('admin user summaries exclude security and contact fields', async () => {
    const r = await api('get', '/admin/users', admin);
    const text = JSON.stringify(r.body);
    expect(text).not.toContain('password');
    expect(text).not.toContain('token');
    expect(text).not.toContain('email');
    expect(text).not.toContain('phone');
  });
  it('suspension revokes sessions, hides discovery and records an audit', async () => {
    const r = await api(
      'patch',
      '/admin/users/' + worker.id + '/status',
      admin,
    ).send({ status: 'SUSPENDED', reason: 'Marketplace policy review' });
    expect(r.status).toBe(200);
    expect((await api('get', '/availability/me', worker)).status).toBe(401);
    expect(
      (await api('get', '/workers')).body.data.workers.some(
        (w) => w.workerId === worker.id,
      ),
    ).toBe(false);
    expect(await AuditEvent.countDocuments({ action: 'USER_SUSPENDED' })).toBe(
      1,
    );
  });
  it('reactivation does not restore revoked sessions', async () => {
    await api('patch', '/admin/users/' + worker.id + '/status', admin).send({
      status: 'SUSPENDED',
      reason: 'Policy review',
    });
    expect(
      (
        await api('patch', '/admin/users/' + worker.id + '/status', admin).send(
          { status: 'ACTIVE', reason: 'Review cleared' },
        )
      ).status,
    ).toBe(200);
    expect((await api('get', '/availability/me', worker)).status).toBe(401);
  });
  it('protects admin accounts and validates arbitrary state mutations', async () => {
    expect(
      (
        await api('patch', '/admin/users/' + admin.id + '/status', admin).send({
          status: 'SUSPENDED',
          reason: 'Invalid request',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api('patch', '/admin/users/' + worker.id + '/status', admin).send(
          { status: 'BOGUS', reason: 'Invalid request' },
        )
      ).status,
    ).toBe(400);
  });
  it('excludes archived demos from admin lists and overview without deleting financial history', async () => {
    const b = await reserve(), r = await checkout(b);
    const paymentId = r.body.data.payment.id;
    await Booking.updateOne({ _id: b.id }, { $set: { adminArchivedAt: new Date(), adminArchiveReason: 'Generated demo cleanup' } });
    for (const path of ['/admin/bookings', '/admin/payments', '/admin/ledger']) {
      const response = await api('get', path, admin);
      expect(response.status).toBe(200);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    }
    const metrics = (await api('get', '/admin/metrics', admin)).body.data;
    expect(metrics.totalBookings).toBe(0);
    expect(metrics.simulatedTransactionVolumeBututs).toBe('0');
    expect((await api('get', '/admin/bookings/' + b.id, admin)).status).toBe(200);
    expect((await api('get', '/admin/payments/' + paymentId, admin)).body.data.entries).toHaveLength(3);
    expect(await Payment.countDocuments({ _id: paymentId })).toBe(1);
    expect(await FinancialLedgerEntry.countDocuments({ payment: paymentId })).toBe(3);
  });
  it('inspects bookings, payments and ledger without financial mutation endpoints', async () => {
    const b = await reserve(),
      r = await checkout(b);
    expect((await api('get', '/admin/bookings/' + b.id, admin)).status).toBe(
      200,
    );
    expect(
      (await api('get', '/admin/payments/' + r.body.data.payment.id, admin))
        .body.data.entries,
    ).toHaveLength(3);
    const customerName = await User.findById(customer.id).select('firstName lastName');
    for (const path of ['/admin/payments', '/admin/ledger']) {
      const response = await api('get', path, admin);
      expect(response.status).toBe(200);
      const row = response.body.data.items.find(row => row.booking === b.id);
      expect(row.customerSummary).toEqual({ id: customer.id, firstName: customerName.firstName, lastName: customerName.lastName });
      expect(row.workerSummary.id).toBe(worker.id);
      expect(Object.keys(row.workerSummary).sort()).toEqual(['firstName', 'id', 'lastName']);
    }
    const detail = (await api('get', '/admin/payments/' + r.body.data.payment.id, admin)).body.data.payment;
    expect(detail.customerSummary.id).toBe(customer.id);
    expect(detail.workerSummary.id).toBe(worker.id);
    const participant = (await api('get', '/payments/' + r.body.data.payment.id, customer)).body.data.payment;
    expect(participant.customerSummary).toBeUndefined();
  });
});
