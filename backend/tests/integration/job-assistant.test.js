import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from '../helpers/mongo-memory.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { Category } from '../../src/modules/catalog/category.model.js';
import { Service } from '../../src/modules/catalog/service.model.js';
import { MediaAsset } from '../../src/modules/media/media.model.js';
import { Booking } from '../../src/modules/bookings/booking.model.js';
import { FakeMediaProvider } from '../helpers/fake-media.provider.js';

let mongo, config, customer, otherCustomer, worker, plumbing, masonry;
const media = new FakeMediaProvider();
// Serves the fake provider's stored bytes for its signed URLs.
const mediaFetch = async url => {
  const key = decodeURIComponent(new URL(url).pathname.slice(1));
  const bytes = media.assets.get(key);
  return bytes ? { ok: true, arrayBuffer: async () => bytes } : { ok: false };
};
const fakeAi = (answer) => ({ available: true, generateJson: vi.fn(async () => answer) });
const goodAnswer = {
  title: 'Repair roof leak above the bedroom',
  description: 'Water drips through the bedroom ceiling when it rains. The stain is about one metre wide. Needs inspection and repair of the roof above.',
  serviceName: 'masonry',
  confidence: 0.82,
  urgency: 'URGENT',
  followUpQuestions: ['Is the roof made of zinc sheets or concrete?'],
  priceMinGmd: 800, priceMaxGmd: 1530,
  safetyNote: 'Keep water away from light switches and sockets.',
  transcript: null, detectedLanguage: null,
};

function appWith(ai, options = {}) {
  return createApp(config, { mediaProvider: media, mediaFetch, aiProvider: ai, authLimit: 10000, globalLimit: 10000, marketWriteLimit: 10000, ...options });
}
async function login(app, user) {
  const r = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Test-password123' });
  expect(r.status).toBe(200);
  return r.body.data.accessToken;
}
async function fixtureUser(role, index) {
  return User.create({ firstName: role + index, lastName: 'Assist', email: 'assist-' + index + '@example.test', phoneNumber: '+220730000' + index, password: 'Test-password123', role });
}
async function storedMedia(owner, purpose, mimeType, bytes) {
  const { storageKey } = await media.upload({ buffer: Buffer.from(bytes), purpose, format: mimeType.split('/')[1] });
  return MediaAsset.create({ owner, purpose, provider: 'fake', storageKey, resourceType: purpose === 'VOICE_NOTE' ? 'video' : 'image',
    format: mimeType.split('/')[1], deliveryType: 'authenticated', mimeType, bytes: bytes.length });
}
const draft = (app, token, body) => request(app).post('/api/assistant/job-draft').set('Authorization', 'Bearer ' + token).send(body);

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_ACCESS_SECRET: 'assistant-access-test-secret-not-production-1', JWT_REFRESH_SECRET: 'assistant-refresh-test-secret-not-production-2', FRONTEND_ORIGIN: 'http://localhost:5173' });
  await connectDatabase(config.MONGODB_URI); await ensureIndexes();
  customer = await fixtureUser('CUSTOMER', 1); otherCustomer = await fixtureUser('CUSTOMER', 2); worker = await fixtureUser('WORKER', 3);
});
beforeEach(async () => {
  for (const Model of [Category, Service, MediaAsset, Booking]) await Model.deleteMany({});
  const home = await Category.create({ name: 'Home', nameKey: 'home', slug: 'home' });
  plumbing = await Service.create({ category: home._id, name: 'Plumbing', nameKey: 'plumbing', slug: 'plumbing' });
  masonry = await Service.create({ category: home._id, name: 'Masonry', nameKey: 'masonry', slug: 'masonry' });
});
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });

describe('AI job description assistant', () => {
  it('reports whether the assistant is switched on', async () => {
    const off = appWith(undefined);
    const offToken = await login(off, customer);
    expect((await request(off).get('/api/assistant/status').set('Authorization', 'Bearer ' + offToken)).body.data).toEqual({ jobDraft: false });
    expect((await draft(off, offToken, { text: 'My roof leaks when it rains' })).status).toBe(503);
    const on = appWith(fakeAi(goodAnswer));
    expect((await request(on).get('/api/assistant/status').set('Authorization', 'Bearer ' + await login(on, customer))).body.data).toEqual({ jobDraft: true });
  });

  it('is only for signed-in customers', async () => {
    const app = appWith(fakeAi(goodAnswer));
    expect((await request(app).post('/api/assistant/job-draft').send({ text: 'roof leak' })).status).toBe(401);
    expect((await draft(app, await login(app, worker), { text: 'My roof leaks when it rains' })).status).toBe(403);
  });

  it('turns a rough description into an editable draft with a catalog service and an AI price estimate', async () => {
    const ai = fakeAi(goodAnswer);
    const app = appWith(ai);
    const r = await draft(app, await login(app, customer), { text: 'water coming from ceiling when rain' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.draft).toMatchObject({
      title: goodAnswer.title, description: goodAnswer.description,
      service: { id: masonry.id, name: 'Masonry' }, urgency: 'URGENT', confidence: 0.82,
      followUpQuestions: goodAnswer.followUpQuestions, safetyNote: goodAnswer.safetyNote,
      // Rounded to the nearest 50 dalasi.
      priceRange: { minBututs: 80000, maxBututs: 155000, source: 'AI_ESTIMATE' },
      transcript: null,
    });
    const { system, parts } = ai.generateJson.mock.calls[0][0];
    expect(system).toContain('"Masonry"');
    expect(system).toContain('"Plumbing"');
    expect(parts[0].text).toContain('water coming from ceiling');
  });

  it('prefers real SkillLink prices once a service has enough bookings', async () => {
    const base = { customer: customer._id, worker: worker._id, service: masonry._id, description: 'Roof work', currency: 'GMD', createdAt: new Date(), updatedAt: new Date() };
    await Booking.collection.insertMany([60000, 90000, 100000, 120000, 400000].map((agreedAmountBututs, i) =>
      ({ ...base, agreedAmountBututs, status: i === 4 ? 'CANCELLED' : 'COMPLETED' })));
    const app = appWith(fakeAi(goodAnswer));
    const r = await draft(app, await login(app, customer), { text: 'water coming from ceiling when rain' });
    expect(r.body.data.draft.priceRange).toEqual({ minBututs: 85000, maxBututs: 105000, source: 'SKILLLINK_BOOKINGS', sampleSize: 4 });
  });

  it('reads the customer’s own photos and voice note and returns the transcript', async () => {
    const ai = fakeAi({ ...goodAnswer, transcript: 'Water is coming through the ceiling when it rains.', detectedLanguage: 'Wolof' });
    const app = appWith(ai);
    const photo = await storedMedia(customer._id, 'JOB_ATTACHMENT', 'image/png', [1, 2, 3, 4]);
    const voice = await storedMedia(customer._id, 'VOICE_NOTE', 'audio/ogg', [9, 8, 7]);
    const r = await draft(app, await login(app, customer), { photos: [photo.id], voice: voice.id });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.draft).toMatchObject({ transcript: 'Water is coming through the ceiling when it rains.', detectedLanguage: 'Wolof' });
    const parts = ai.generateJson.mock.calls[0][0].parts;
    expect(parts).toContainEqual({ inlineData: { mimeType: 'image/png', data: Buffer.from([1, 2, 3, 4]).toString('base64') } });
    expect(parts).toContainEqual({ inlineData: { mimeType: 'audio/ogg', data: Buffer.from([9, 8, 7]).toString('base64') } });
  });

  it('refuses another customer’s photos', async () => {
    const ai = fakeAi(goodAnswer);
    const app = appWith(ai);
    const photo = await storedMedia(otherCustomer._id, 'JOB_ATTACHMENT', 'image/png', [1]);
    const r = await draft(app, await login(app, customer), { photos: [photo.id] });
    expect(r.status).toBe(400);
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it('never sends phone numbers or emails to the AI', async () => {
    const ai = fakeAi(goodAnswer);
    const app = appWith(ai);
    const token = await login(app, customer);
    for (const text of ['roof leaking, call 877 123 456', 'roof leaking, email me at me@example.com']) {
      const r = await draft(app, token, { text });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('CONTACT_SHARING_BLOCKED');
    }
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it('rejects unusable AI answers instead of showing them', async () => {
    const token = async app => login(app, customer);
    const withContact = appWith(fakeAi({ ...goodAnswer, description: goodAnswer.description + ' Call +220 877123456.' }));
    expect((await draft(withContact, await token(withContact), { text: 'roof leak in bedroom' })).status).toBe(502);
    const malformed = appWith(fakeAi({ title: 'x' }));
    expect((await draft(malformed, await token(malformed), { text: 'roof leak in bedroom' })).status).toBe(502);
  });

  it('leaves the service empty when the AI suggests something outside the catalog', async () => {
    const app = appWith(fakeAi({ ...goodAnswer, serviceName: 'Rocket repair', priceMinGmd: null, priceMaxGmd: null }));
    const r = await draft(app, await login(app, customer), { text: 'roof leak in bedroom' });
    expect(r.body.data.draft.service).toBeNull();
    expect(r.body.data.draft.priceRange).toBeNull();
  });

  it('limits how often one customer can use it', async () => {
    const app = appWith(fakeAi(goodAnswer), { assistantLimit: 2 });
    const token = await login(app, customer);
    expect((await draft(app, token, { text: 'roof leak in bedroom' })).status).toBe(200);
    expect((await draft(app, token, { text: 'roof leak in bedroom' })).status).toBe(200);
    const third = await draft(app, token, { text: 'roof leak in bedroom' });
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });
});

void mongoose;
