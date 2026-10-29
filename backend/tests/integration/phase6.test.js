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
  await User.updateMany({}, { $set: { accountStatus: 'ACTIVE' } });
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
describe('Phase 6 simulated payments and ledger', () => {
  it('calculates integer commission and floors fractional bututs', () => {
    expect(breakdown(100000, 1000)).toMatchObject({
      platformFeeBututs: 10000,
      workerAmountBututs: 90000,
    });
    expect(breakdown(101, 1000)).toMatchObject({
      platformFeeBututs: 10,
      workerAmountBututs: 91,
    });
    expect(
      breakdown(Number.MAX_SAFE_INTEGER, 1000).workerAmountBututs +
        breakdown(Number.MAX_SAFE_INTEGER, 1000).platformFeeBututs,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each([-1, 1.2, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid money %s',
    (n) => expect(() => breakdown(n, 1000)).toThrow(),
  );
  it('successful simulation holds funds and confirms booking atomically', async () => {
    const b = await reserve(),
      r = await checkout(b);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.payment.status).toBe('HELD');
    expect((await Booking.findById(b.id)).status).toBe('CONFIRMED');
    expect(await FinancialLedgerEntry.countDocuments()).toBe(3);
  });
  it('failure does not confirm or create ledger movements', async () => {
    const b = await reserve(),
      r = await checkout(b, customer, 'FAILURE');
    expect(r.body.data.payment.status).toBe('FAILED');
    expect((await Booking.findById(b.id)).status).toBe('AWAITING_PAYMENT');
    expect(await FinancialLedgerEntry.countDocuments()).toBe(0);
  });
  it('pending can be resolved through a new simulated attempt', async () => {
    const b = await reserve();
    expect(
      (await checkout(b, customer, 'PENDING')).body.data.payment.status,
    ).toBe('PENDING');
    expect(
      (await checkout(b, customer, 'SUCCESS', 'resolve-pending')).body.data
        .payment.status,
    ).toBe('HELD');
    expect(await Payment.countDocuments()).toBe(1);
  });
  it('retries the same key without duplicate ledger or provider actions', async () => {
    const b = await reserve(),
      a = await checkout(b),
      r = await checkout(b);
    expect(r.body.data.idempotent).toBe(true);
    expect(r.body.data.payment.id).toBe(a.body.data.payment.id);
    expect(await FinancialLedgerEntry.countDocuments()).toBe(3);
    expect(await PaymentAttempt.countDocuments()).toBe(1);
  });
  it('rejects idempotency key payload changes', async () => {
    const b = await reserve();
    await checkout(b, customer, 'FAILURE');
    expect((await checkout(b, customer, 'SUCCESS')).status).toBe(409);
  });
  it('prevents a second successful charge under another key', async () => {
    const b = await reserve();
    await checkout(b);
    expect((await checkout(b, customer, 'SUCCESS', 'another-key')).status).toBe(
      409,
    );
  });
  it('serializes concurrent checkout attempts', async () => {
    const b = await reserve();
    const r = await Promise.all([
      checkout(b),
      checkout(b, customer, 'SUCCESS', 'other-key'),
    ]);
    expect(r.map((v) => v.status).sort()).toEqual([200, 409]);
    expect(await FinancialLedgerEntry.countDocuments()).toBe(3);
  });
  it('rejects wrong role, wrong owner and expired reservations', async () => {
    const b = await reserve();
    expect((await checkout(b, worker)).status).toBe(403);
    expect((await checkout(b, stranger)).status).toBe(404);
    await Booking.updateOne(
      { _id: b._id },
      { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } },
    );
    expect((await checkout(b)).status).toBe(409);
  });
  it('protects payment, ledger and worker balance access', async () => {
    const b = await reserve(),
      r = await checkout(b),
      id = r.body.data.payment.id;
    expect((await api('get', '/payments/' + id, stranger)).status).toBe(404);
    expect(
      (await api('get', '/payments/' + id + '/ledger', worker)).body.data
        .entries,
    ).toHaveLength(3);
    const f = await api('get', '/finances/me', worker);
    expect(f.body.data.pendingEarningsBututs).toBe('40500');
    expect(f.body.data.simulated).toBe(true);
    expect((await api('get', '/finances/me', customer)).status).toBe(403);
  });
  it('rolls back financial state if ledger persistence fails', async () => {
    const b = await reserve();
    vi.spyOn(FinancialLedgerEntry, 'create').mockRejectedValueOnce(
      new Error('test write failure'),
    );
    expect((await checkout(b)).status).toBe(500);
    expect((await Booking.findById(b.id)).status).toBe('AWAITING_PAYMENT');
    expect(await Payment.countDocuments()).toBe(0);
  });
});
