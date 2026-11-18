import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from '../helpers/mongo-memory.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { WorkerProfile } from '../../src/modules/workers/worker.model.js';
import { Category } from '../../src/modules/catalog/category.model.js';
import { Service } from '../../src/modules/catalog/service.model.js';
import { MediaAsset } from '../../src/modules/media/media.model.js';
import { Verification } from '../../src/modules/verifications/verification.model.js';
import { DirectProposal } from '../../src/modules/bookings/proposal.model.js';
import { responseStatsFor } from '../../src/modules/ranking/response-stats.js';
import { FakeMediaProvider } from '../helpers/fake-media.provider.js';

let mongo, app, near, far, unverified, customer, admin, service;
const api = (method, path, actor) => { const r = request(app)[method]('/api' + path); return actor ? r.set('Authorization', 'Bearer ' + actor.token) : r; };
const minutes = n => n * 60 * 1000;

async function fixtureUser(role, index) {
  const user = await User.create({ firstName: role + index, lastName: 'Ranker', email: 'ranking-' + index + '@example.test', phoneNumber: '+220720000' + index, password: 'Test-password123', role });
  const r = await api('post', '/auth/login').send({ email: user.email, password: 'Test-password123' }); expect(r.status).toBe(200);
  return { id: user.id, token: r.body.data.accessToken };
}
async function profile(actor, coordinates, { approved = false, ...extra } = {}) {
  await WorkerProfile.create({ user: actor.id, professionTitle: 'Plumber', bio: 'Pipe repairs, leaks and bathroom installations across the area.',
    services: [service._id], skills: ['Leak repair'], serviceAreas: [{ name: 'Brikama', region: 'West Coast', country: 'GM' }],
    primaryLocation: { type: 'Point', coordinates }, serviceRadiusKm: 50, profileVisibility: 'PUBLIC',
    pricing: [{ service: service._id, type: 'QUOTE_REQUIRED' }], ...extra });
  if (approved) {
    const asset = await MediaAsset.create({ owner: actor.id, purpose: 'IDENTITY_DOCUMENT', provider: 'fake', storageKey: 'identity/' + actor.id, resourceType: 'image', format: 'png', deliveryType: 'authenticated', mimeType: 'image/png', bytes: 100 });
    await Verification.create({ worker: actor.id, identityDocument: asset._id, status: 'APPROVED', reviewedAt: new Date(), reviewedBy: admin.id });
  }
}
// Raw inserts let the test control createdAt/updatedAt exactly.
function rawProposal(workerId, { createdAgoMinutes, status, respondedAfterMinutes, expiresInMinutes = 60 * 24 }) {
  const createdAt = new Date(Date.now() - minutes(createdAgoMinutes));
  return {
    customer: new mongoose.Types.ObjectId(customer.id), worker: new mongoose.Types.ObjectId(workerId), service: service._id,
    description: 'Fix a leaking pipe under the kitchen sink.', serviceArea: { name: 'Brikama', region: 'West Coast', country: 'GM' },
    pricingMode: 'NEGOTIATED', agreedAmountBututs: 50000, quotes: [], quoteRevision: 0,
    scheduledStart: new Date(Date.now() + minutes(60 * 48)), scheduledEnd: new Date(Date.now() + minutes(60 * 50)),
    status, expiresAt: new Date(Date.now() + minutes(expiresInMinutes)),
    ...(respondedAfterMinutes === undefined ? {} : { respondedAt: new Date(createdAt.getTime() + minutes(respondedAfterMinutes)) }),
    createdAt, updatedAt: createdAt,
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_ACCESS_SECRET: 'ranking-access-test-secret-not-production-123', JWT_REFRESH_SECRET: 'ranking-refresh-test-secret-not-production-456', FRONTEND_ORIGIN: 'http://localhost:5173' });
  app = createApp(config, { mediaProvider: new FakeMediaProvider(), authLimit: 10000, globalLimit: 10000, marketWriteLimit: 10000 });
  await connectDatabase(config.MONGODB_URI); await ensureIndexes();
  near = await fixtureUser('WORKER', 1); far = await fixtureUser('WORKER', 2); unverified = await fixtureUser('WORKER', 3);
  customer = await fixtureUser('CUSTOMER', 4); admin = await fixtureUser('ADMIN', 5);
});
beforeEach(async () => {
  for (const Model of [WorkerProfile, Category, Service, MediaAsset, Verification, DirectProposal]) await Model.deleteMany({});
  const category = await Category.create({ name: 'Home', nameKey: 'home', slug: 'home' });
  service = await Service.create({ category: category._id, name: 'Plumbing', nameKey: 'plumbing', slug: 'plumbing' });
  // Customer searches from Brikama (-16.65, 13.27).
  await profile(near, [-16.652, 13.271], { approved: true, averageRating: 4.8, reviewCount: 12, completedJobsCount: 12, availableNow: true });
  await profile(far, [-16.9, 13.4], { approved: true, averageRating: 4.9, reviewCount: 2 });
  await profile(unverified, [-16.66, 13.28]);
});
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });

describe('Recommended worker ranking', () => {
  it('is the default order and explains every card', async () => {
    const r = await api('get', '/workers');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.workers).toHaveLength(3);
    for (const w of r.body.data.workers) {
      expect(w.recommendation.score).toBeGreaterThanOrEqual(0);
      expect(w.recommendation.score).toBeLessThanOrEqual(100);
      expect(w.recommendation.reasons.length).toBeGreaterThan(0);
      expect(w.recommendation.reasons.length).toBeLessThanOrEqual(3);
    }
    const scores = r.body.data.workers.map(w => w.recommendation.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
  it('puts the nearby, verified, well-reviewed worker first', async () => {
    const r = await api('get', '/workers?sort=recommended&longitude=-16.65&latitude=13.27&radiusKm=50');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.workers[0].workerId).toBe(near.id);
    expect(r.body.data.workers[0].recommendation.reasons.map(x => x.code)).toContain('NEARBY');
  });
  it('keeps other sort orders working', async () => {
    const r = await api('get', '/workers?sort=rating');
    expect(r.status).toBe(200);
    // Plain rating order puts 4.9 from 2 reviews above 4.8 from 12; the ranking does not.
    expect(r.body.data.workers[0].workerId).toBe(far.id);
    expect(r.body.data.workers[0]).not.toHaveProperty('recommendation');
  });
  it('paginates the ranked list without repeating or skipping workers', async () => {
    const pages = await Promise.all([1, 2, 3].map(page => api('get', '/workers?limit=1&page=' + page)));
    const ids = pages.map(p => p.body.data.workers[0].workerId);
    expect(new Set(ids).size).toBe(3);
    expect(pages[0].body.data.pagination).toMatchObject({ total: 3, totalPages: 3, hasNextPage: true });
  });
  it('does not leak exact distances, coordinates or the internal factor breakdown', async () => {
    const r = await api('get', '/workers?longitude=-16.65&latitude=13.27&radiusKm=50');
    const text = JSON.stringify(r.body);
    for (const field of ['factors', 'distanceMeters', 'distanceKm', 'coordinates', 'primaryLocation', 'email', 'phoneNumber']) expect(text).not.toContain('"' + field + '"');
    expect(text).not.toContain('-16.652');
  });
});

describe('Worker responsiveness', () => {
  it('measures answer rate and average answer time from recent requests', async () => {
    await DirectProposal.collection.insertMany([
      rawProposal(near.id, { createdAgoMinutes: 300, status: 'REJECTED', respondedAfterMinutes: 10 }),
      rawProposal(near.id, { createdAgoMinutes: 600, status: 'QUOTED', respondedAfterMinutes: 30 }),
      rawProposal(near.id, { createdAgoMinutes: 900, status: 'ACCEPTED', respondedAfterMinutes: 20 }),
      // Let expire without answering: counts against the worker.
      rawProposal(near.id, { createdAgoMinutes: 3000, status: 'EXPIRED' }),
      // Customer cancelled before any answer, and a still-open request: both ignored.
      rawProposal(near.id, { createdAgoMinutes: 100, status: 'CANCELLED' }),
      rawProposal(near.id, { createdAgoMinutes: 50, status: 'PENDING' }),
      // Older than the 180-day window: ignored.
      rawProposal(near.id, { createdAgoMinutes: 60 * 24 * 200, status: 'EXPIRED', expiresInMinutes: -60 * 24 * 190 }),
    ]);
    const stats = (await responseStatsFor([near.id, far.id])).get(near.id);
    expect(stats).toMatchObject({ received: 4, responded: 3 });
    expect(stats.averageMinutes).toBeCloseTo(20, 5);
    expect((await responseStatsFor([far.id])).has(far.id)).toBe(false);
  });
  it('shows a fast-reply reason once a worker has a real answer history', async () => {
    await DirectProposal.collection.insertMany([1, 2, 3].map(i => rawProposal(near.id, { createdAgoMinutes: 100 * i, status: 'REJECTED', respondedAfterMinutes: 15 })));
    const r = await api('get', '/workers');
    const card = r.body.data.workers.find(w => w.workerId === near.id);
    expect(card.recommendation.reasons.map(x => x.code)).toContain('FAST_REPLIES');
  });
  it('records the first answer time when a worker declines a request', async () => {
    const [id] = Object.values((await DirectProposal.collection.insertMany([rawProposal(near.id, { createdAgoMinutes: 5, status: 'PENDING' })])).insertedIds);
    const r = await api('post', '/direct-proposals/' + id + '/reject', near).send({});
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const saved = await DirectProposal.findById(id);
    expect(saved.status).toBe('REJECTED');
    expect(saved.respondedAt).toBeInstanceOf(Date);
  });
});
