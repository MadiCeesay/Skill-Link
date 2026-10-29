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
describe('Phase 7 execution, settlement and reviews', () => {
  it('worker starts a confirmed booking at its scheduled time', async () => {
    const b = await started();
    expect((await Booking.findById(b.id)).status).toBe('IN_PROGRESS');
  });
  it('rejects starting before schedule or in an unpaid state', async () => {
    const b = await reserve();
    expect(
      (await api('post', '/bookings/' + b.id + '/start', worker).send({}))
        .status,
    ).toBe(409);
    await checkout(b);
    expect(
      (await api('post', '/bookings/' + b.id + '/start', worker).send({}))
        .status,
    ).toBe(409);
  });
  it('rejects wrong worker and customer-controlled worker transitions', async () => {
    const b = await paid();
    expect(
      (await api('post', '/bookings/' + b.id + '/start', second).send({}))
        .status,
    ).toBe(404);
    expect(
      (await api('post', '/bookings/' + b.id + '/start', customer).send({}))
        .status,
    ).toBe(403);
  });
  it('worker completion keeps funds held until customer confirmation', async () => {
    const b = await marked();
    expect((await Payment.findOne({ booking: b._id })).status).toBe('HELD');
    expect((await Booking.findById(b.id)).workerCompletedAt).toBeTruthy();
  });
  it('confirms completion and releases funds once', async () => {
    const b = await completed();
    expect((await Payment.findOne({ booking: b._id })).status).toBe('RELEASED');
    expect(
      await FinancialLedgerEntry.countDocuments({ type: 'WORKER_RELEASE' }),
    ).toBe(1);
    expect(
      (await WorkerProfile.findOne({ user: worker.id })).completedJobsCount,
    ).toBe(1);
    expect(
      (
        await api(
          'post',
          '/bookings/' + b.id + '/confirm-completion',
          customer,
        ).send({})
      ).status,
    ).toBe(409);
  });
  it('stores completion evidence privately', async () => {
    const b = await started(),
      u = await upload(worker, 'COMPLETION_EVIDENCE');
    expect(
      (
        await api('post', '/bookings/' + b.id + '/complete', worker).send({
          evidence: [u.body.data.media.id],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api(
          'get',
          '/bookings/' + b.id + '/evidence/' + u.body.data.media.id + '/access',
          customer,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await api(
          'get',
          '/bookings/' + b.id + '/evidence/' + u.body.data.media.id + '/access',
          stranger,
        )
      ).status,
    ).toBe(404);
    expect(
      (await WorkerProfile.findOne({ user: worker.id })).portfolio,
    ).toHaveLength(0);
  });
  it('dispute freezes booking and funds and protects ownership', async () => {
    const { b, d } = await disputed();
    expect((await Booking.findById(b.id)).status).toBe('DISPUTED');
    expect((await Payment.findOne({ booking: b._id })).status).toBe('DISPUTED');
    expect((await api('get', '/disputes/' + d.id, stranger)).status).toBe(404);
  });
  it('admin releases disputed funds with an audit event', async () => {
    const { b, d } = await disputed();
    const r = await api(
      'post',
      '/admin/disputes/' + d.id + '/resolve',
      admin,
    ).send({
      decision: 'RELEASE_TO_WORKER',
      reason: 'Evidence supports completed work',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await Booking.findById(b.id)).status).toBe('COMPLETED');
    expect((await Payment.findOne({ booking: b._id })).status).toBe('RELEASED');
    expect(
      await AuditEvent.countDocuments({ action: 'DISPUTE_RESOLVED' }),
    ).toBe(1);
  });
  it('admin refund records consistent states', async () => {
    const { b, d } = await disputed();
    expect(
      (
        await api('post', '/admin/disputes/' + d.id + '/resolve', admin).send({
          decision: 'REFUND_CUSTOMER',
          reason: 'Repair was not performed correctly',
        })
      ).status,
    ).toBe(200);
    expect((await Booking.findById(b.id)).status).toBe('CANCELLED');
    expect((await Payment.findOne({ booking: b._id })).status).toBe('REFUNDED');
    expect(await FinancialLedgerEntry.countDocuments({ type: 'REFUND' })).toBe(
      1,
    );
  });
  it('denies non-admin dispute resolution', async () => {
    const { d } = await disputed();
    expect(
      (
        await api(
          'post',
          '/admin/disputes/' + d.id + '/resolve',
          customer,
        ).send({ decision: 'REFUND_CUSTOMER', reason: 'Please refund' })
      ).status,
    ).toBe(403);
  });
  it('rolls back settlement if auditing fails', async () => {
    const { b, d } = await disputed();
    vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(Error('test'));
    expect(
      (
        await api('post', '/admin/disputes/' + d.id + '/resolve', admin).send({
          decision: 'REFUND_CUSTOMER',
          reason: 'Valid reason',
        })
      ).status,
    ).toBe(500);
    expect((await Payment.findOne({ booking: b._id })).status).toBe('DISPUTED');
    expect((await Dispute.findById(d.id)).status).toBe('OPEN');
  });
  it('only completed bookings accept reviews from their customer', async () => {
    const b = await reserve();
    expect(
      (
        await api('post', '/bookings/' + b.id + '/reviews', customer).send({
          rating: 5,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api('post', '/bookings/' + b.id + '/reviews', stranger).send({
          rating: 5,
        })
      ).status,
    ).toBe(404);
  });
  it('reports persistent review eligibility only to the booking customer', async () => {
    const b = await completed();
    const before = await api('get', '/bookings/' + b.id, customer);
    expect(before.status).toBe(200);
    expect(before.body.data.reviewEligibility).toEqual({ canReview: true, hasReviewed: false });
    const workerView = await api('get', '/bookings/' + b.id, worker);
    expect(workerView.body.data.reviewEligibility).toEqual({ canReview: false, hasReviewed: false });
    expect((await api('post', '/bookings/' + b.id + '/reviews', customer).send({ rating: 5 })).status).toBe(201);
    const after = await api('get', '/bookings/' + b.id, customer);
    expect(after.body.data.reviewEligibility).toEqual({ canReview: false, hasReviewed: true });
  });
  it('updates reputation and rejects duplicate reviews', async () => {
    const b = await completed(),
      r = await api('post', '/bookings/' + b.id + '/reviews', customer).send({
        rating: 4,
        comment: 'Careful work',
      });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const p = await WorkerProfile.findOne({ user: worker.id });
    expect(p.averageRating).toBe(4);
    expect(p.reviewCount).toBe(1);
    expect(
      (
        await api('post', '/bookings/' + b.id + '/reviews', customer).send({
          rating: 5,
        })
      ).status,
    ).toBe(409);
  });
  it.each([0, 6, 2.5])('rejects invalid rating %s', async (rating) => {
    const b = await reserve();
    expect(
      (
        await api('post', '/bookings/' + b.id + '/reviews', customer).send({
          rating,
        })
      ).status,
    ).toBe(400);
  });
  it('moderation hides without altering rating and recomputes counters', async () => {
    const b = await completed(),
      r = await api('post', '/bookings/' + b.id + '/reviews', customer).send({
        rating: 2,
        comment: 'Inappropriate content',
      }),
      id = r.body.data.review.id;
    expect(
      (
        await api('patch', '/admin/reviews/' + id + '/moderation', admin).send({
          status: 'HIDDEN',
          reason: 'Content policy',
        })
      ).status,
    ).toBe(200);
    expect((await Review.findById(id)).rating).toBe(2);
    const p = await WorkerProfile.findOne({ user: worker.id });
    expect(p.reviewCount).toBe(0);
    expect(p.averageRating).toBe(0);
    expect(
      (await api('get', '/workers/' + worker.id + '/reviews')).body.data
        .reviews,
    ).toHaveLength(0);
    expect(
      await AuditEvent.countDocuments({ action: 'REVIEW_MODERATED' }),
    ).toBe(1);
  });
});
