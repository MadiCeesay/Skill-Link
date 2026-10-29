import { createServer } from 'node:http';
import { io as client } from 'socket.io-client';
import { attachSocket } from '../../src/realtime/socket.js';
import {
  Conversation,
  Message,
} from '../../src/modules/conversations/conversation.model.js';
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
  Conversation,
  Message,
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

async function chat() {
  const p = await pending();
  const r = await api('post', '/conversations', customer).send({
    contextType: 'DIRECT_PROPOSAL',
    contextId: p.id,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data.conversation;
}
const send = (c, text, actor = customer, id = 'msg1') =>
  api('post', '/conversations/' + c.id + '/messages', actor).send({
    type: 'TEXT',
    text,
    clientMessageId: id,
  });
function wav() {
  const b = Buffer.alloc(60);
  b.write('RIFF');
  b.writeUInt32LE(52, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(16, 40);
  return b;
}
describe('Phase 5 private messaging and voice', () => {
  it('creates only participant conversations', async () => {
    const c = await chat();
    expect(c.participants).toContain(worker.id);
    expect((await api('get', '/conversations/' + c.id, stranger)).status).toBe(
      404,
    );
  });
  it('cannot create conversation on someone else context', async () => {
    const p = await pending();
    expect(
      (
        await api('post', '/conversations', stranger).send({
          contextType: 'DIRECT_PROPOSAL',
          contextId: p.id,
        })
      ).status,
    ).toBe(404);
  });
  it('persists text and supports private history', async () => {
    const c = await chat();
    expect((await send(c, 'Please explain the repair process.')).status).toBe(
      201,
    );
    const r = await api('get', '/conversations/' + c.id + '/messages', worker);
    expect(r.body.data.messages[0].text).toContain('repair');
    expect(
      (await api('get', '/conversations/' + c.id + '/messages', stranger))
        .status,
    ).toBe(404);
  });
  it('deduplicates client message IDs and rejects changed payloads', async () => {
    const c = await chat();
    await send(c, 'Hello there');
    await send(c, 'Hello there');
    expect(await Message.countDocuments()).toBe(1);
    expect((await send(c, 'Changed message')).status).toBe(409);
  });
  it('tracks read state', async () => {
    const c = await chat();
    await send(c, 'Hello there');
    expect(
      (await api('post', '/conversations/' + c.id + '/read', worker).send({}))
        .status,
    ).toBe(200);
    expect((await Message.findOne()).readBy.map(String)).toContain(worker.id);
  });
  it.each([
    'Call +220 710 00 01',
    'Call 7100001',
    'Reach me at worker@example.com',
    'wa.me/2207100001',
    'https://instagram.com/worker',
  ])('blocks obvious contact: %s', async (text) => {
    const c = await chat();
    expect((await send(c, text)).status).toBe(400);
    expect(await Message.countDocuments()).toBe(0);
  });
  it.each([
    'Price GMD 1500 for 20 metres',
    'Need 300 bricks and 12 bags',
    'Room dimensions 3.5 x 4 metres',
  ])('permits work numbers: %s', async (text) =>
    expect((await send(await chat(), text)).status).toBe(201),
  );
  it('stores image messages with participant-only media links', async () => {
    const c = await chat(),
      u = await upload(customer, 'CHAT_IMAGE');
    expect(u.status).toBe(201);
    const r = await api(
      'post',
      '/conversations/' + c.id + '/messages',
      customer,
    ).send({
      type: 'IMAGE',
      media: u.body.data.media.id,
      clientMessageId: 'image1',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(
      (
        await api(
          'get',
          '/conversations/' +
            c.id +
            '/media/' +
            u.body.data.media.id +
            '/access',
          worker,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await api(
          'get',
          '/conversations/' +
            c.id +
            '/media/' +
            u.body.data.media.id +
            '/access',
          stranger,
        )
      ).status,
    ).toBe(404);
  });
  it('uploads and plays protected voice recordings', async () => {
    const c = await chat(),
      u = await api('post', '/media/VOICE_NOTE', customer).attach(
        'file',
        wav(),
        { filename: 'note.wav', contentType: 'audio/wav' },
      );
    expect(u.status, JSON.stringify(u.body)).toBe(201);
    const r = await api(
      'post',
      '/conversations/' + c.id + '/messages',
      customer,
    ).send({
      type: 'VOICE',
      media: u.body.data.media.id,
      clientMessageId: 'voice1',
    });
    expect(r.status).toBe(201);
    expect(
      (
        await api(
          'get',
          '/conversations/' +
            c.id +
            '/media/' +
            u.body.data.media.id +
            '/access',
          worker,
        )
      ).status,
    ).toBe(200);
  });
  it('rejects malformed audio and wrong media purposes', async () => {
    expect(
      (
        await api('post', '/media/VOICE_NOTE', customer).attach(
          'file',
          Buffer.from('executable'),
          { filename: 'bad.wav', contentType: 'audio/wav' },
        )
      ).status,
    ).toBe(400);
    const c = await chat(),
      u = await upload();
    expect(
      (
        await api(
          'post',
          '/conversations/' + c.id + '/messages',
          customer,
        ).send({
          type: 'IMAGE',
          media: u.body.data.media.id,
          clientMessageId: 'wrong',
        })
      ).status,
    ).toBe(400);
  });
  it('rejects media owned by the other participant', async () => {
    const c = await chat(),
      u = await upload(worker, 'CHAT_IMAGE');
    expect(
      (
        await api(
          'post',
          '/conversations/' + c.id + '/messages',
          customer,
        ).send({
          type: 'IMAGE',
          media: u.body.data.media.id,
          clientMessageId: 'stolen',
        })
      ).status,
    ).toBe(400);
  });
  it('authenticates sockets, authorizes rooms and persists before acknowledgment', async () => {
    const c = await chat(),
      server = createServer(app),
      io = attachSocket(server, app, {
        FRONTEND_ORIGIN: 'http://localhost:5173',
      });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port;
    const sockets = [];
    try {
      const connect = (token) =>
        new Promise((resolve, reject) => {
          const s = client(url, {
            auth: { token },
            transports: ['websocket'],
            reconnection: false,
          });
          sockets.push(s);
          s.once('connect', () => resolve(s));
          s.once('connect_error', reject);
        });
      await expect(connect('bad-token')).rejects.toThrow();
      const owner = await connect(customer.token),
        other = await connect(stranger.token);
      const emit = (s, event, payload) =>
        new Promise((resolve) =>
          s
            .timeout(3000)
            .emit(event, payload, (err, value) =>
              resolve(err ? { success: false } : value),
            ),
        );
      expect(
        (await emit(other, 'conversation:join', { conversation: c.id }))
          .success,
      ).toBe(false);
      expect(
        (await emit(owner, 'conversation:join', { conversation: c.id }))
          .success,
      ).toBe(true);
      expect(
        (
          await emit(owner, 'message:send', {
            conversation: c.id,
            message: {
              type: 'TEXT',
              text: 'Socket persisted message',
              clientMessageId: 'socket1',
            },
          })
        ).success,
      ).toBe(true);
      expect(await Message.countDocuments()).toBe(1);
    } finally {
      sockets.forEach((s) => s.disconnect());
      await new Promise((resolve) => io.close(resolve));
    }
  });
});
