import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from '../helpers/mongo-memory.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { WorkerProfile } from '../../src/modules/workers/worker.model.js';
import { Category } from '../../src/modules/catalog/category.model.js';
import { Service } from '../../src/modules/catalog/service.model.js';
import { MediaAsset } from '../../src/modules/media/media.model.js';
import { Booking } from '../../src/modules/bookings/booking.model.js';
import { DirectProposal } from '../../src/modules/bookings/proposal.model.js';
import { JobRequest } from '../../src/modules/jobRequests/job.model.js';
import { Quote } from '../../src/modules/quotes/quote.model.js';
import { Conversation, Message } from '../../src/modules/conversations/conversation.model.js';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { FakeMediaProvider } from '../helpers/fake-media.provider.js';
let mongo, app, customer, worker, outsider, admin, service, booking, conversation, photo;
const auth = (method, path, person) => request(app)[method]('/api' + path).set('Authorization', 'Bearer ' + person.token);
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_ACCESS_SECRET: 'test-presentation-access-secret-123456789', JWT_REFRESH_SECRET: 'test-presentation-refresh-secret-987654321', FRONTEND_ORIGIN: 'http://localhost:5173' });
  await connectDatabase(config.MONGODB_URI);
  app = createApp(config, { mediaProvider: new FakeMediaProvider(), authLimit: 10000, globalLimit: 10000 });
  await ensureIndexes();
  const people = [];
  for (const [index, [firstName, lastName, role]] of [['Bruno', 'Ceesay', 'CUSTOMER'], ['Musa', 'Banja', 'WORKER'], ['Other', 'Customer', 'CUSTOMER'], ['Demo', 'Operator', 'ADMIN']].entries()) {
    const user = await User.create({ firstName, lastName, role, email: `${index}@example.test`, phoneNumber: '+220700000' + index, password: 'Test-password123' });
    const result = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Test-password123' });
    people.push({ _id: user._id, token: result.body.data.accessToken });
  }
  [customer, worker, outsider, admin] = people;
  const category = await Category.create({ name: 'Repairs', nameKey: 'repairs', slug: 'repairs' });
  service = await Service.create({ category: category._id, name: 'Electrician', nameKey: 'electrician', slug: 'electrician' });
  photo = await MediaAsset.create({ owner: worker._id, purpose: 'PROFILE_IMAGE', mimeType: 'image/png', bytes: 10, provider: 'fake', storageKey: 'public-worker-photo', resourceType: 'image', format: 'png', deliveryType: 'authenticated' });
  await WorkerProfile.create({ user: worker._id, profileImage: photo._id, professionTitle: 'Electrician', bio: 'Experienced electrical repair professional.', services: [service._id], serviceAreas: [{ name: 'Brikama', country: 'GM' }], profileVisibility: 'PUBLIC' });
});
beforeEach(async () => {
  for (const Model of [Booking, DirectProposal, JobRequest, Quote, Conversation, Message, Notification]) await Model.deleteMany({});
  await WorkerProfile.updateOne({ user: worker._id }, { $set: { profileVisibility: 'PUBLIC', profileImage: photo._id } });
  booking = await Booking.create({ customer: customer._id, worker: worker._id, service: service._id, description: 'Repair the ceiling light.', agreedAmountBututs: 49979, scheduledStart: new Date(Date.now() - 3600000), scheduledEnd: new Date(Date.now() + 3600000), status: 'COMPLETED', completedAt: new Date() });
  conversation = await Conversation.create({ customer: customer._id, worker: worker._id, participants: [customer._id, worker._id], contextType: 'BOOKING', contextId: booking._id, booking: booking._id });
});
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });

it.each(['customer', 'worker'])('adds only allowed counterpart and service fields to %s booking list/detail and conversations', async role => {
  const viewer = role === 'customer' ? customer : worker;
  const expectedName = role === 'customer' ? 'Musa' : 'Bruno';
  for (const path of ['/bookings/me', '/bookings/' + booking.id, '/conversations/me', '/conversations/' + conversation.id]) {
    const response = await auth('get', path, viewer);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const data = response.body.data;
    const item = data.bookings?.[0] || data.booking || data.conversations?.[0] || data.conversation;
    expect(item.counterpart.firstName).toBe(expectedName);
    expect(Object.keys(item.counterpart).sort()).toEqual(['firstName', 'id', 'lastName', 'profileImage']);
    expect(item.serviceSummary).toEqual({ id: service.id, name: 'Electrician' });
    expect(item.status).toBe('COMPLETED');
    expect(JSON.stringify(item.counterpart)).not.toMatch(/email|phoneNumber|password|storageKey|coordinates/);
    if (role === 'customer') expect(item.counterpart.profileImage.url).toContain('https://media.example.test/');
    else expect(item.counterpart.profileImage).toBeNull();
  }
});
it('does not grant an outsider or an admin conversation access', async () => {
  expect((await auth('get', '/bookings/' + booking.id, outsider)).status).toBe(404);
  expect((await auth('get', '/bookings/me', outsider)).body.data.bookings).toHaveLength(0);
  expect((await auth('get', '/conversations/' + conversation.id, outsider)).status).toBe(404);
  expect((await auth('get', '/conversations/' + conversation.id, admin)).status).toBe(403);
});
it('does not expose an unpublished profile photo or substitute a private document for a photo', async () => {
  await WorkerProfile.updateOne({ user: worker._id }, { $set: { profileVisibility: 'DRAFT' } });
  expect((await auth('get', '/bookings/' + booking.id, customer)).body.data.booking.counterpart.profileImage).toBeNull();
  await MediaAsset.updateOne({ _id: photo._id }, { $set: { purpose: 'IDENTITY_DOCUMENT' } });
  await WorkerProfile.updateOne({ user: worker._id }, { $set: { profileVisibility: 'PUBLIC' } });
  expect((await auth('get', '/conversations/me', customer)).body.data.conversations[0].counterpart.profileImage).toBeNull();
  await MediaAsset.updateOne({ _id: photo._id }, { $set: { purpose: 'PROFILE_IMAGE' } });
});
it('uses the proposal status until booking and then follows the linked booking status', async () => {
  const proposal = await DirectProposal.create({ customer: customer._id, worker: worker._id, service: service._id, description: 'Inspect the electrical panel.', scheduledStart: new Date(Date.now() + 86400000), scheduledEnd: new Date(Date.now() + 90000000), agreedAmountBututs: 50000, expiresAt: new Date(Date.now() + 3600000) });
  await Conversation.deleteMany({});
  const c = await Conversation.create({ customer: customer._id, worker: worker._id, participants: [customer._id, worker._id], contextType: 'DIRECT_PROPOSAL', contextId: proposal._id });
  expect((await auth('get', '/conversations/' + c.id, customer)).body.data.conversation.status).toBe('PENDING');
  await Booking.updateOne({ _id: booking._id }, { $set: { directProposal: proposal._id, status: 'IN_PROGRESS' } });
  expect((await auth('get', '/conversations/' + c.id, customer)).body.data.conversation.status).toBe('IN_PROGRESS');
});
it('resolves quote conversations through their job service and treats expired quotes honestly', async () => {
  const job = await JobRequest.create({ customer: customer._id, service: service._id, title: 'Electrical repairs', description: 'Inspect and repair the electrical installation.', serviceArea: { name: 'Brikama', country: 'GM' }, areaKey: 'brikama', expiresAt: new Date(Date.now() + 86400000) });
  const quote = await Quote.create({ customer: customer._id, worker: worker._id, jobRequest: job._id, proposedAmountBututs: 50000, expiresAt: new Date(Date.now() - 1000) });
  await Conversation.deleteMany({});
  const c = await Conversation.create({ customer: customer._id, worker: worker._id, participants: [customer._id, worker._id], contextType: 'QUOTE', contextId: quote._id });
  const response = await auth('get', '/conversations/' + c.id, worker);
  expect(response.body.data.conversation).toMatchObject({ status: 'EXPIRED', counterpart: { firstName: 'Bruno' }, serviceSummary: { name: 'Electrician' } });
});
it('rewrites legacy notification copy using only an authorized booking, person and service', async () => {
  const n = await Notification.create({ recipient: customer._id, type: 'BOOKING_WORKER_MARKED_COMPLETED', title: 'SkillLink update', message: 'booking worker marked completed', eventKey: 'legacy-event', relatedResourceType: 'Booking', relatedResourceId: booking._id });
  const response = await auth('get', '/notifications/me', customer);
  expect(response.status).toBe(200);
  const result = response.body.data.notifications[0];
  expect(result.title).toBe('Work is ready for confirmation');
  expect(result.message).toContain('Musa Banja marked the Electrician booking #');
  expect(result.message).not.toMatch(/@|\+220|booking worker marked completed/);
  expect(result.readAt).toBeNull();
  expect((await auth('post', '/notifications/' + n.id + '/read', customer).send({})).body.data.notification.readAt).toBeTruthy();
  expect((await auth('get', '/notifications/me', outsider)).body.data.notifications).toHaveLength(0);
});
it('does not enrich a stale notification that references another customer\'s booking', async () => {
  await Notification.create({ recipient: outsider._id, type: 'BOOKING_CONFIRMED', title: 'Old title', message: 'Old message', eventKey: 'mismatched', relatedResourceType: 'Booking', relatedResourceId: booking._id });
  const result = (await auth('get', '/notifications/me', outsider)).body.data.notifications[0];
  expect(result.message).not.toContain('Musa');
  expect(result.message).not.toContain('Electrician');
});
it('counts accepted public jobs globally, separately from direct proposals and a customer\'s list', async () => {
  await JobRequest.create({ customer: outsider._id, service: service._id, title: 'Other customer job', description: 'Inspect and repair the electrical panel.', serviceArea: { name: 'Brikama', country: 'GM' }, areaKey: 'brikama', status: 'QUOTE_ACCEPTED', expiresAt: new Date(Date.now() + 86400000) });
  const metrics = (await auth('get', '/admin/metrics', admin)).body.data;
  expect(metrics.acceptedJobs).toBe(1);
  expect((await auth('get', '/job-requests/me', customer)).body.data.jobRequests).toHaveLength(0);
});
it('keeps valid cents exact and rejects fractional bututs at the API boundary', async () => {
  expect((await auth('get', '/bookings/' + booking.id, customer)).body.data.booking.agreedAmountBututs).toBe(49979);
  const start = new Date(Date.now() + 86400000); start.setUTCSeconds(0, 0);
  const end = new Date(start.getTime() + 3600000);
  const r = await auth('post', '/direct-proposals', customer).send({ worker: worker._id, service: service._id, description: 'Please inspect the electrical installation.', serviceArea: { name: 'Brikama', country: 'GM' }, scheduledStart: start.toISOString(), scheduledEnd: end.toISOString(), agreedAmountBututs: 49979.5 });
  expect(r.status).toBe(400);
  expect(r.body.error.details.some(issue => issue.field === 'agreedAmountBututs')).toBe(true);
});
