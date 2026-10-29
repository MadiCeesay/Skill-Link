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
describe('Private quote requests', () => {
  const request = extra => pending({ agreedAmountBututs: undefined, pricingMode: 'REQUEST_QUOTE', ...extra });
  const sendQuote = (p, extra = {}, actor = worker) => api('post', '/direct-proposals/' + p.id + '/quote', actor)
    .send({ amountBututs: 120000, note: 'Includes labour and materials', revision: 0, ...extra });
  const acceptQuote = (p, revision = 1, actor = customer) => api('post', '/direct-proposals/' + p.id + '/accept-quote', actor).send({ revision });

  it('creates a genuine quote request without a price and preserves location privacy', async () => {
    const p = await request();
    expect(p.agreedAmountBututs).toBeUndefined();
    expect((await DirectProposal.findById(p.id)).agreedAmountBututs).toBeUndefined();
    expect(p.location.coordinates).toEqual([-16.651, 13.271]);
    const result = await api('get', '/direct-proposals/' + p.id, worker);
    expect(result.body.data.proposal.location).toBeUndefined();
    expect(result.body.data.proposal.privateAddress).toBeUndefined();
    expect((await api('post', '/direct-proposals/' + p.id + '/accept', worker).send({})).status).toBe(409);
    expect(await Booking.countDocuments()).toBe(0);
  });
  it('records an optional budget separately and books/pays exactly the accepted quote', async () => {
    const p = await request({ budget: { minAmountBututs: 50000, maxAmountBututs: 100000 } });
    const quoted = await sendQuote(p, { amountBututs: 85000 });
    expect(quoted.status, JSON.stringify(quoted.body)).toBe(200);
    expect(quoted.body.data.proposal.agreedAmountBututs).toBeUndefined();
    const accepted = await acceptQuote(p);
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    const b = await Booking.findById(accepted.body.data.proposal.booking);
    expect(b.agreedAmountBututs).toBe(85000);
    const payment = await api('post', '/payments/bookings/' + b.id + '/checkout', customer).send({ outcome: 'SUCCESS', idempotencyKey: 'private-quote-payment-12345' });
    expect(payment.status, JSON.stringify(payment.body)).toBe(200);
    expect(payment.body.data.payment.amountBututs).toBe(85000);
    expect((await acceptQuote(p)).body.data.proposal.booking).toBe(b.id);
    expect(await Booking.countDocuments()).toBe(1);
  });
  it('rejects invalid/zero budgets and fabricated customer amounts', async () => {
    for (const extra of [
      { budget: { minAmountBututs: 0, maxAmountBututs: 100 } },
      { budget: { minAmountBututs: 200, maxAmountBututs: 100 } },
      { agreedAmountBututs: 0 },
    ]) expect((await api('post', '/direct-proposals', customer).send(direct({ pricingMode: 'REQUEST_QUOTE', agreedAmountBututs: undefined, ...extra }))).status).toBe(400);
  });
  it('preserves quote history and prevents acceptance of a superseded quote', async () => {
    const p = await request();
    expect((await sendQuote(p)).status).toBe(200);
    expect((await sendQuote(p, { revision: 1, amountBututs: 100000 })).status).toBe(200);
    expect((await acceptQuote(p, 1)).status).toBe(409);
    expect((await sendQuote(p, { revision: 1 })).status).toBe(409);
    const accepted = await acceptQuote(p, 2);
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.proposal.quotes).toHaveLength(2);
    expect((await Booking.findById(accepted.body.data.proposal.booking)).agreedAmountBututs).toBe(100000);
    expect((await sendQuote(p, { revision: 2 })).status).toBe(409);
  });
  it('requires the exact participants and eligible worker', async () => {
    const p = await request();
    expect((await sendQuote(p, {}, second)).status).toBe(404);
    expect((await sendQuote(p, {}, customer)).status).toBe(403);
    expect((await acceptQuote(p, 1, stranger)).status).toBe(404);
    await Verification.updateOne({ worker: worker.id }, { status: 'REJECTED' });
    expect((await sendQuote(p)).status).toBe(403);
  });
  it('does not reserve a slot until acceptance and rolls back conflicts', async () => {
    const p = await request();
    expect((await sendQuote(p)).status).toBe(200);
    await reserve();
    expect((await acceptQuote(p)).status).toBe(409);
    expect((await DirectProposal.findById(p.id)).status).toBe('QUOTED');
    expect(await Booking.countDocuments()).toBe(1);
  });
  it('creates only one booking under simultaneous acceptance', async () => {
    const p = await request(); await sendQuote(p);
    const results = await Promise.all([acceptQuote(p), acceptQuote(p)]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    expect(results[0].body.data.proposal.booking).toBe(results[1].body.data.proposal.booking);
    expect(await Booking.countDocuments()).toBe(1);
  });
  it('allows decline/cancellation without creating a booking', async () => {
    const p = await request(); await sendQuote(p);
    expect((await api('post', '/direct-proposals/' + p.id + '/decline-quote', customer).send({})).status).toBe(200);
    expect((await acceptQuote(p)).status).toBe(409);
    expect(await Booking.countDocuments()).toBe(0);
    const other = await request(); await sendQuote(other);
    expect((await api('post', '/direct-proposals/' + other.id + '/cancel', customer).send({})).status).toBe(200);
    expect((await acceptQuote(other)).status).toBe(409);
  });
  it('expires quotes and rejects zero, unsafe or client-expired prices', async () => {
    const p = await request();
    for (const extra of [{ amountBututs: 0 }, { amountBututs: Number.MAX_SAFE_INTEGER + 1 }, { expiresAt: new Date(Date.now() - 10000).toISOString() }])
      expect((await sendQuote(p, extra)).status).toBe(400);
    await sendQuote(p);
    await DirectProposal.updateOne({ _id: p.id }, { $set: { 'quotes.0.expiresAt': new Date(Date.now() - 1000) } });
    expect((await acceptQuote(p)).status).toBe(409);
  });
  it('uses the actual fixed price and rejects listed hourly/starting/quote-required totals', async () => {
    for (const type of ['HOURLY', 'STARTING_FROM', 'QUOTE_REQUIRED']) {
      await WorkerProfile.updateOne({ user: worker.id }, { $set: { pricing: [{ service: service.id, type, ...(type === 'QUOTE_REQUIRED' ? {} : { amountBututs: 50000 }) }] } });
      expect((await api('post', '/direct-proposals', customer).send(direct({ agreedAmountBututs: undefined, pricingMode: 'LISTED_PRICE', listedAmountBututs: 50000 }))).status).toBe(409);
      const p = await request(); expect(p.agreedAmountBututs).toBeUndefined();
    }
    await WorkerProfile.updateOne({ user: worker.id }, { $set: { pricing: [{ service: service.id, type: 'FIXED', amountBututs: 40000 }] } });
    expect((await api('post', '/direct-proposals', customer).send(direct({ agreedAmountBututs: undefined, pricingMode: 'LISTED_PRICE', listedAmountBututs: 50000 }))).status).toBe(409);
    const p = await pending({ agreedAmountBututs: undefined, pricingMode: 'LISTED_PRICE', listedAmountBututs: 40000 });
    expect(p.agreedAmountBututs).toBe(40000);
    expect((await api('post', '/direct-proposals/' + p.id + '/accept', worker).send({})).status).toBe(200);
    expect((await Booking.findOne({ directProposal: p.id })).agreedAmountBututs).toBe(40000);
  });
  it('reuses protected job photos and rejects other owners/purposes and strangers', async () => {
    const uploaded = await upload();
    const id = uploaded.body.data.media.id;
    const p = await request({ attachments: [id] });
    const path = '/direct-proposals/' + p.id + '/attachments/' + id + '/access';
    expect((await api('get', path, worker)).status).toBe(200);
    expect((await api('get', path, stranger)).status).toBe(404);
    expect((await api('get', path.replace(id + '/access', unknown + '/access'), worker)).status).toBe(404);
    expect((await api('post', '/direct-proposals', stranger).send(direct({ agreedAmountBututs: undefined, pricingMode: 'REQUEST_QUOTE', attachments: [id] }))).status).toBe(400);
  });
});

describe('Phase 4 availability and centralized bookings', () => {
  it('retrieves and updates own availability', async () => {
    const r = await api('patch', '/availability/me', worker).send({
      weekly: [
        { day: 1, start: '09:00', end: '12:00' },
        { day: 1, start: '14:00', end: '18:00' },
      ],
    });
    expect(r.status).toBe(200);
    expect(
      (await api('get', '/availability/me', worker)).body.data.availability
        .timezone,
    ).toBe('Africa/Banjul');
  });
  it('rejects overlapping recurring intervals', async () =>
    expect(
      (
        await api('patch', '/availability/me', worker).send({
          weekly: [
            { day: 1, start: '09:00', end: '12:00' },
            { day: 1, start: '11:00', end: '13:00' },
          ],
        })
      ).status,
    ).toBe(400));
  it('rejects malformed and reversed time ranges', async () => {
    for (const i of [
      { day: 1, start: '25:00', end: '26:00' },
      { day: 1, start: '12:00', end: '09:00' },
    ])
      expect(
        (await api('patch', '/availability/me', worker).send({ weekly: [i] }))
          .status,
      ).toBe(400);
  });
  it('blocks customer availability changes', async () =>
    expect(
      (await api('patch', '/availability/me', customer).send({ weekly: [] }))
        .status,
    ).toBe(403));
  it('toggles availableNow without bypassing schedule', async () => {
    expect(
      (
        await api('patch', '/availability/available-now', worker).send({
          availableNow: true,
        })
      ).status,
    ).toBe(200);
    const p = await pending(slot(6, 7));
    expect(
      (
        await api('post', '/direct-proposals/' + p.id + '/accept', worker).send(
          {},
        )
      ).status,
    ).toBe(409);
  });
  it('respects blocked civil dates', async () => {
    await Availability.updateOne(
      { worker: worker.id },
      { $set: { blockedDates: [start().toISOString().slice(0, 10)] } },
    );
    const p = await pending();
    expect(
      (
        await api('post', '/direct-proposals/' + p.id + '/accept', worker).send(
          {},
        )
      ).status,
    ).toBe(409);
  });
  it('respects time off intervals', async () => {
    await Availability.updateOne(
      { worker: worker.id },
      {
        $set: {
          timeOff: [
            { start: start(), end: new Date(start().getTime() + 3600000) },
          ],
        },
      },
    );
    const p = await pending();
    expect(
      (
        await api('post', '/direct-proposals/' + p.id + '/accept', worker).send(
          {},
        )
      ).status,
    ).toBe(409);
  });
  it('requires worker consent for direct proposals', async () => {
    const p = await pending();
    expect(await Booking.countDocuments()).toBe(0);
    expect(
      (
        await api(
          'post',
          '/direct-proposals/' + p.id + '/accept',
          customer,
        ).send({})
      ).status,
    ).toBe(403);
  });
  it('accepts direct proposal into one centralized booking', async () => {
    const b = await reserve();
    expect(b.status).toBe('AWAITING_PAYMENT');
    expect(b.agreedAmountBututs).toBe(45000);
    expect(b.directProposal).toBeTruthy();
  });
  it('converts an accepted quote into a booking idempotently', async () => {
    const j = await job(),
      q = await quote(j);
    await accept(q);
    const body = { quote: q.id, ...slot() };
    const a = await api('post', '/bookings/from-quote', customer).send(body),
      b = await api('post', '/bookings/from-quote', customer).send(body);
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    expect(b.body.data.booking.id).toBe(a.body.data.booking.id);
    expect(await Booking.countDocuments()).toBe(1);
  });
  it.each([
    [10, 11],
    [10, 12],
    [9, 12],
    [10, 10.5],
    [9, 10.5],
  ])('rejects overlap %s-%s', async (a, b) => {
    await reserve();
    const p = await pending(slot(a, b));
    expect(
      (
        await api('post', '/direct-proposals/' + p.id + '/accept', worker).send(
          {},
        )
      ).status,
    ).toBe(409);
  });
  it('allows adjacent intervals', async () => {
    await reserve();
    await reserve(slot(11, 12));
    expect(await Booking.countDocuments()).toBe(2);
  });
  it('allows only one simultaneous reservation for the same slot', async () => {
    const a = await pending(),
      b = await pending();
    const r = await Promise.all(
      [a, b].map((p) =>
        api('post', '/direct-proposals/' + p.id + '/accept', worker).send({}),
      ),
    );
    expect(r.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(await Booking.countDocuments()).toBe(1);
  });
  it('ignores expired unpaid reservations for conflict checks', async () => {
    const b = await reserve();
    await Booking.updateOne(
      { _id: b._id },
      { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } },
    );
    await reserve();
    expect(await Booking.countDocuments()).toBe(2);
  });
  it('cancellation releases a reservation', async () => {
    const b = await reserve();
    expect(
      (
        await api('post', '/bookings/' + b.id + '/cancel', customer).send({
          reason: 'Plans changed',
        })
      ).status,
    ).toBe(200);
    await reserve();
  });
  it('cannot hide an existing reservation through availability changes', async () => {
    await reserve();
    expect(
      (await api('patch', '/availability/me', worker).send({ weekly: [] }))
        .status,
    ).toBe(409);
  });
  it('enforces participant ownership and precise-location privacy', async () => {
    const b = await reserve();
    expect((await api('get', '/bookings/' + b.id, stranger)).status).toBe(404);
    expect(
      (await api('get', '/bookings/' + b.id, worker)).body.data.booking,
    ).not.toHaveProperty('location');
    expect(
      (await api('get', '/bookings/' + b.id, customer)).body.data.booking
        .location.coordinates,
    ).toEqual(jobInput().location.coordinates);
  });
  it('rejects unverified workers and inactive customers', async () => {
    expect(
      (
        await api('post', '/direct-proposals', customer).send(
          direct({ worker: unverified.id }),
        )
      ).status,
    ).toBe(403);
    await User.updateOne(
      { _id: customer.id },
      { $set: { accountStatus: 'SUSPENDED' } },
    );
    expect(
      (await api('post', '/direct-proposals', customer).send(direct())).status,
    ).toBe(403);
  });
  it('rejects unauthorized and reversed schedules', async () => {
    expect(
      (
        await api('post', '/bookings/from-quote', worker).send({
          quote: unknown,
          ...slot(),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api('post', '/direct-proposals', customer).send(
          direct(slot(12, 10)),
        )
      ).status,
    ).toBe(400);
  });
});
