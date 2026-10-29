import {
  Conversation,
  Message,
} from '../../src/modules/conversations/conversation.model.js';
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
  afterEach,
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
  Conversation,
  Message,
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
    messageLimit: 10000,
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
afterEach(() => vi.useRealTimers());
describe('Phase 9 marketplace integration and security boundaries', () => {
  it('runs registration through verification, quote, booking, messaging, payment, completion and review', async () => {
    const register = async (role, index) => {
      const credentials = {
        firstName: 'Demo',
        lastName: role,
        email: 'demo-' + index + '@example.test',
        phoneNumber: '+220799000' + index,
        password: 'Demo-password123',
      };
      expect(
        (await api('post', '/auth/register/' + role).send(credentials)).status,
      ).toBe(201);
      const r = await api('post', '/auth/login').send({
        email: credentials.email,
        password: credentials.password,
      });
      expect(r.status).toBe(200);
      return {
        id: r.body.data.user.id,
        token: r.body.data.accessToken,
        credentials,
      };
    };
    const c = await register('customer', 1),
      w = await register('worker', 2);
    expect(
      (
        await api('post', '/workers/me/profile', w).send({
          professionTitle: 'Electrician',
          bio: 'Experienced residential electrician serving homes throughout Brikama.',
          services: [service.id],
          serviceAreas: [
            { name: 'Brikama', region: 'West Coast', country: 'GM' },
          ],
          primaryLocation: { type: 'Point', coordinates: [-16.65, 13.27] },
          profileVisibility: 'PUBLIC',
        })
      ).status,
    ).toBe(201);
    const u = await upload(w, 'IDENTITY_DOCUMENT');
    expect(u.status).toBe(201);
    const v = await api('post', '/verifications', w).send({
      identityDocument: u.body.data.media.id,
    });
    expect(v.status).toBe(201);
    expect(
      (
        await api(
          'patch',
          '/admin/verifications/' + v.body.data.verification.id,
          admin,
        ).send({ decision: 'APPROVED' })
      ).status,
    ).toBe(200);
    expect(
      (
        await api('patch', '/availability/me', w).send({
          weekly: Array.from({ length: 7 }, (_, day) => ({
            day,
            start: '08:00',
            end: '20:00',
          })),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api('get', '/workers?service=' + service.id + '&verified=true')
      ).body.data.workers.some((p) => p.workerId === w.id),
    ).toBe(true);
    const j = await job({}, c),
      q = await quote(j, w);
    expect((await accept(q, c)).status).toBe(200);
    const br = await api('post', '/bookings/from-quote', c).send({
      quote: q.id,
      ...slot(),
    });
    expect(br.status, JSON.stringify(br.body)).toBe(201);
    const b = br.body.data.booking;
    const cr = await api('post', '/conversations', c).send({
      contextType: 'BOOKING',
      contextId: b.id,
    });
    expect(cr.status).toBe(201);
    const cid = cr.body.data.conversation.id;
    expect(
      (
        await api('post', '/conversations/' + cid + '/messages', c).send({
          type: 'TEXT',
          text: 'Please bring your electrical testing tools.',
          clientMessageId: 'e2e-text',
        })
      ).status,
    ).toBe(201);
    const sound = Buffer.alloc(60);
    sound.write('RIFF');
    sound.writeUInt32LE(52, 4);
    sound.write('WAVEfmt ', 8);
    sound.writeUInt32LE(16, 16);
    sound.writeUInt16LE(1, 20);
    sound.writeUInt16LE(1, 22);
    sound.writeUInt32LE(8000, 24);
    sound.writeUInt32LE(16000, 28);
    sound.writeUInt16LE(2, 32);
    sound.writeUInt16LE(16, 34);
    sound.write('data', 36);
    sound.writeUInt32LE(16, 40);
    const voice = await api('post', '/media/VOICE_NOTE', c).attach(
      'file',
      sound,
      { filename: 'voice.wav', contentType: 'audio/wav' },
    );
    expect(voice.status).toBe(201);
    expect(
      (
        await api('post', '/conversations/' + cid + '/messages', c).send({
          type: 'VOICE',
          media: voice.body.data.media.id,
          clientMessageId: 'e2e-voice',
        })
      ).status,
    ).toBe(201);
    expect((await checkout(b, c)).body.data.payment.status).toBe('HELD');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(new Date(b.scheduledStart).getTime() + 60000));
    for (const actor of [c, w]) {
      const login = await api('post', '/auth/login').send({
        email: actor.credentials.email,
        password: actor.credentials.password,
      });
      expect(login.status).toBe(200);
      actor.token = login.body.data.accessToken;
    }
    expect(
      (await api('post', '/bookings/' + b.id + '/start', w).send({})).status,
    ).toBe(200);
    const evidence = await upload(w, 'COMPLETION_EVIDENCE');
    expect(evidence.status).toBe(201);
    expect(
      (
        await api('post', '/bookings/' + b.id + '/complete', w).send({
          notes: 'Fault repaired and safely tested.',
          evidence: [evidence.body.data.media.id],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api('post', '/bookings/' + b.id + '/confirm-completion', c).send(
          {},
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await api('post', '/bookings/' + b.id + '/reviews', c).send({
          rating: 5,
          comment: 'Careful and reliable work.',
        })
      ).status,
    ).toBe(201);
    expect((await Payment.findOne({ booking: b.id })).status).toBe('RELEASED');
    expect(await FinancialLedgerEntry.countDocuments({ booking: b.id })).toBe(
      4,
    );
    const p = await WorkerProfile.findOne({ user: w.id });
    expect(p.reviewCount).toBe(1);
    expect(p.averageRating).toBe(5);
    expect(p.completedJobsCount).toBe(1);
    expect(
      await Notification.countDocuments({ recipient: c.id }),
    ).toBeGreaterThan(0);
  }, 60000);
  it('completion and dispute racing cannot both settle the same payment', async () => {
    const b = await marked();
    const r = await Promise.all([
      api('post', '/bookings/' + b.id + '/confirm-completion', customer).send(
        {},
      ),
      api('post', '/bookings/' + b.id + '/dispute', customer).send(
        disputeInput(),
      ),
    ]);
    expect(r.filter((v) => v.status < 300)).toHaveLength(1);
    const booking = await Booking.findById(b.id),
      payment = await Payment.findOne({ booking: b.id });
    expect([
      ['COMPLETED', 'RELEASED'],
      ['DISPUTED', 'DISPUTED'],
    ]).toContainEqual([booking.status, payment.status]);
  });
  it('concurrent review submissions preserve one review and exact counters', async () => {
    const b = await completed();
    const r = await Promise.all(
      [4, 5].map((rating) =>
        api('post', '/bookings/' + b.id + '/reviews', customer).send({
          rating,
        }),
      ),
    );
    expect(r.map((v) => v.status).sort()).toEqual([201, 409]);
    expect(await Review.countDocuments({ booking: b.id })).toBe(1);
    expect((await WorkerProfile.findOne({ user: worker.id })).reviewCount).toBe(
      1,
    );
  });
  it('strictly rejects arbitrary lifecycle and financial fields', async () => {
    const b = await reserve();
    expect(
      (
        await api(
          'post',
          '/payments/bookings/' + b.id + '/checkout',
          customer,
        ).send({
          outcome: 'SUCCESS',
          idempotencyKey: 'test-key',
          amountBututs: 1,
          status: 'RELEASED',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api('post', '/bookings/' + b.id + '/complete', worker).send({
          status: 'COMPLETED',
          evidence: [],
        })
      ).status,
    ).toBe(400);
  });
  it('keeps all private resource groups authenticated', async () => {
    for (const p of [
      '/bookings/me',
      '/direct-proposals/me',
      '/conversations/me',
      '/notifications/me',
      '/finances/me',
      '/admin/metrics',
    ])
      expect((await api('get', p)).status).toBe(401);
  });
  it('bounds IDs and pagination on all new private groups', async () => {
    for (const p of [
      '/bookings/not-an-id',
      '/conversations/not-an-id',
      '/payments/not-an-id',
      '/disputes/not-an-id',
    ])
      expect((await api('get', p, customer)).status).toBe(400);
    for (const p of [
      '/bookings/me',
      '/direct-proposals/me',
      '/conversations/me',
      '/notifications/me',
    ])
      expect((await api('get', p + '?limit=999', customer)).status).toBe(400);
  });
  it('optional email delivery failure cannot undo an important transaction', async () => {
    app = createApp(
      loadConfig({
        NODE_ENV: 'test',
        MONGODB_URI: mongo.getUri(),
        JWT_ACCESS_SECRET: 'phase3-access-test-secret-not-production-123',
        JWT_REFRESH_SECRET: 'phase3-refresh-test-secret-not-production-456',
        FRONTEND_ORIGIN: 'http://localhost:5173',
      }),
      {
        mediaProvider: fake,
        emailProvider: {
          send: async () => {
            throw Error('test SMTP unavailable');
          },
        },
        globalLimit: 10000,
        authLimit: 10000,
        uploadLimit: 10000,
        marketWriteLimit: 10000,
      },
    );
    const b = await reserve();
    expect((await checkout(b)).status).toBe(200);
    expect((await Booking.findById(b.id)).status).toBe('CONFIRMED');
  });
});
