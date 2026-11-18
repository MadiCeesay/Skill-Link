import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'node:http';
import { io as clientSocket } from 'socket.io-client';
import { MongoMemoryReplSet } from '../helpers/mongo-memory.js';
import { createApp } from '../../src/app.js';
import { attachSocket } from '../../src/realtime/socket.js';
import { loadConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { WorkerProfile } from '../../src/modules/workers/worker.model.js';
import { Category } from '../../src/modules/catalog/category.model.js';
import { Service } from '../../src/modules/catalog/service.model.js';
import { MediaAsset } from '../../src/modules/media/media.model.js';
import { Verification } from '../../src/modules/verifications/verification.model.js';
import { Availability } from '../../src/modules/availability/availability.model.js';
import { Booking } from '../../src/modules/bookings/booking.model.js';
import { DirectProposal } from '../../src/modules/bookings/proposal.model.js';
import { Conversation, Message, ChatPriceOffer } from '../../src/modules/conversations/conversation.model.js';
import { Payment, PaymentAttempt, FinancialLedgerEntry } from '../../src/modules/payments/payment.model.js';
import { FakeMediaProvider } from '../helpers/fake-media.provider.js';
let mongo, app, io, server, customer, worker, outsider, service, proposal, conversation;
const sockets = [];
const api = (method, path, person = customer) => request(app)[method]('/api' + path).set('Authorization', 'Bearer ' + person.token);
const path = () => '/conversations/' + conversation.id + '/price-offers';
const offer = async (person = customer, amountBututs = 65000) => {
  const r = await api('post', path(), person).send({ amountBututs });
  expect(r.status, JSON.stringify(r.body)).toBe(201); return r.body.data.offer;
};
const respond = (o, decision = 'ACCEPTED', person = worker) => api('post', path() + '/' + o.id + '/respond', person).send({ decision });
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_ACCESS_SECRET: 'price-access-test-only-secret-12345678', JWT_REFRESH_SECRET: 'price-refresh-test-only-secret-1234567', FRONTEND_ORIGIN: 'http://localhost:5173' });
  await connectDatabase(config.MONGODB_URI);
  app = createApp(config, { mediaProvider: new FakeMediaProvider(), authLimit: 10000, globalLimit: 10000, messageLimit: 10000 });
  await ensureIndexes();
  const people = [];
  for (const [i, role] of ['CUSTOMER', 'WORKER', 'CUSTOMER'].entries()) {
    const u = await User.create({ firstName: 'Demo', lastName: 'Person' + i, role, email: 'chat-price-' + i + '@example.test', phoneNumber: '+220755000' + i, password: 'Test-password123' });
    const login = await request(app).post('/api/auth/login').send({ email: u.email, password: 'Test-password123' });
    people.push({ _id: u._id, token: login.body.data.accessToken });
  }
  [customer, worker, outsider] = people;
  const category = await Category.create({ name: 'Repairs', nameKey: 'repairs', slug: 'repairs' });
  service = await Service.create({ category: category._id, name: 'Carpentry', nameKey: 'carpentry', slug: 'carpentry' });
  await WorkerProfile.create({ user: worker._id, professionTitle: 'Carpenter', bio: 'Wooden furniture and door repairs in Brikama.', services: [service._id], serviceAreas: [{ name: 'Brikama', country: 'GM' }], profileVisibility: 'PUBLIC' });
  const media = await MediaAsset.create({ owner: worker._id, purpose: 'IDENTITY_DOCUMENT', mimeType: 'image/png', bytes: 10, provider: 'fake', storageKey: 'test-identity', resourceType: 'image', format: 'png', deliveryType: 'authenticated' });
  await Verification.create({ worker: worker._id, identityDocument: media._id, status: 'APPROVED' });
  await Availability.create({ worker: worker._id, weekly: Array.from({ length: 7 }, (_, day) => ({ day, start: '00:00', end: '23:59' })) });
  server = createServer(app); io = attachSocket(server, app, config); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
});
beforeEach(async () => {
  vi.restoreAllMocks();
  for (const Model of [ChatPriceOffer, Message, Conversation, DirectProposal, Booking, FinancialLedgerEntry, PaymentAttempt, Payment]) await Model.deleteMany({});
  await WorkerProfile.updateOne({ user: worker._id }, { $set: { profileVisibility: 'PUBLIC' } });
  const start = new Date(Date.now() + 2 * 86400000); start.setUTCHours(10, 0, 0, 0);
  const r = await api('post', '/direct-proposals').send({ worker: String(worker._id), service: service.id, description: 'Please repair the wooden door and its frame.', serviceArea: { name: 'Brikama', country: 'GM' }, agreedAmountBututs: 50000, scheduledStart: start.toISOString(), scheduledEnd: new Date(+start + 3600000).toISOString() });
  expect(r.status, JSON.stringify(r.body)).toBe(201); proposal = r.body.data.proposal;
  const c = await api('post', '/conversations').send({ contextType: 'DIRECT_PROPOSAL', contextId: proposal.id });
  conversation = c.body.data.conversation;
});
afterEach(() => { vi.restoreAllMocks(); sockets.splice(0).forEach(s => s.disconnect()); });
afterAll(async () => { if (io) await new Promise(resolve => io.close(resolve)); await disconnectDatabase(); await mongo?.stop(); });

it.each(['CUSTOMER', 'WORKER'])('accepts a price from %s atomically and the existing booking flow uses that amount', async role => {
  const sender = role === 'CUSTOMER' ? customer : worker, recipient = role === 'CUSTOMER' ? worker : customer;
  await DirectProposal.updateOne({ _id: proposal.id }, { $set: { pricingMode: 'REQUEST_QUOTE' }, $unset: { agreedAmountBututs: 1 } });
  const o = await offer(sender, 49979);
  expect((await respond(o, 'ACCEPTED', recipient)).status).toBe(200);
  const p = await DirectProposal.findById(proposal.id);
  expect(p.agreedAmountBututs).toBe(49979); expect(p.pricingMode).toBe('NEGOTIATED'); expect(p.status).toBe('PENDING');
  expect(await Booking.countDocuments()).toBe(0);
  expect(await Message.countDocuments({ type: 'SYSTEM', text: /GMD 499\.79/ })).toBe(1);
  const accepted = await api('post', '/direct-proposals/' + proposal.id + '/accept', worker).send({});
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
  expect((await Booking.findById(accepted.body.data.proposal.booking)).agreedAmountBututs).toBe(49979);
});
it('declines without changing the proposal and rejects a repeated response', async () => {
  const o = await offer(); expect((await respond(o, 'DECLINED')).status).toBe(200);
  expect((await DirectProposal.findById(proposal.id)).agreedAmountBututs).toBe(50000);
  expect((await respond(o)).status).toBe(409);
  expect((await ChatPriceOffer.findById(o.id)).status).toBe('DECLINED');
});
it('replaces the previous offer from either side and rejects stale acceptance', async () => {
  const old = await offer(), latest = await offer(worker, 70000);
  expect((await ChatPriceOffer.findById(old.id)).status).toBe('REPLACED');
  expect(await ChatPriceOffer.countDocuments({ status: 'OPEN' })).toBe(1);
  expect((await respond(old)).status).toBe(409);
  expect((await respond(latest, 'ACCEPTED', customer)).status).toBe(200);
  const history = await api('get', '/conversations/' + conversation.id + '/messages');
  expect(history.body.data.messages.filter(m => m.priceOffer).map(m => m.priceOffer.status).sort()).toEqual(['ACCEPTED', 'REPLACED']);
});
it('forbids sending and responding after payment and leaves the ledger and agreed price unchanged', async () => {
  const o = await offer();
  const accepted = await api('post', '/direct-proposals/' + proposal.id + '/accept', worker).send({});
  const paid = await api('post', '/payments/bookings/' + accepted.body.data.proposal.booking + '/checkout').send({ idempotencyKey: 'price-locked-payment', outcome: 'SUCCESS' });
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  const baseline = JSON.stringify(await FinancialLedgerEntry.find().lean());
  expect((await api('post', path()).send({ amountBututs: 90000 })).status).toBe(409);
  expect((await respond(o)).status).toBe(409);
  expect((await DirectProposal.findById(proposal.id)).agreedAmountBututs).toBe(50000);
  expect(JSON.stringify(await FinancialLedgerEntry.find().lean())).toBe(baseline);
});
it('enforces participant, recipient, expiry, money and existing profile checks', async () => {
  const o = await offer();
  expect((await respond(o, 'ACCEPTED', customer)).status).toBe(404);
  expect((await respond(o, 'ACCEPTED', outsider)).status).toBe(404);
  for (const amountBututs of [0, -1, 499.79, Number.MAX_SAFE_INTEGER + 1]) expect((await api('post', path()).send({ amountBututs })).status).toBe(400);
  await WorkerProfile.updateOne({ user: worker._id }, { $set: { profileVisibility: 'DRAFT' } });
  expect((await respond(o)).status).toBe(403);
  expect((await ChatPriceOffer.findById(o.id)).status).toBe('OPEN');
  await DirectProposal.updateOne({ _id: proposal.id }, { $set: { expiresAt: new Date(0) } });
  expect((await respond(o)).status).toBe(409);
});
it('rolls the amount and response back when the system message cannot be saved', async () => {
  const o = await offer(); vi.spyOn(Message, 'create').mockRejectedValueOnce(Error('test failure'));
  expect((await respond(o)).status).toBe(500);
  expect((await DirectProposal.findById(proposal.id)).agreedAmountBututs).toBe(50000);
  expect((await ChatPriceOffer.findById(o.id)).status).toBe('OPEN');
});
it('serializes concurrent replacements and permits only one response', async () => {
  await Promise.all([offer(customer, 60000), offer(worker, 70000)]);
  expect(await ChatPriceOffer.countDocuments({ status: 'OPEN' })).toBe(1);
  const current = await ChatPriceOffer.findOne({ status: 'OPEN' });
  const recipient = String(current.recipient) === String(customer._id) ? customer : worker;
  const replies = await Promise.all([respond({ id: current.id }, 'ACCEPTED', recipient), respond({ id: current.id }, 'DECLINED', recipient)]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
});
async function socket(person) {
  const s = clientSocket('http://127.0.0.1:' + server.address().port, { auth: { token: person.token }, transports: ['websocket'], forceNew: true }); sockets.push(s);
  await new Promise((resolve, reject) => { s.once('connect', resolve); s.once('connect_error', reject); });
  const joined = await s.timeout(5000).emitWithAck('conversation:join', { conversation: conversation.id }); expect(joined.success).toBe(true); return s;
}
const nextOffer = s => new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(Error('No live price offer event')), 8000); s.once('price-offer', data => { clearTimeout(timeout); resolve(data); }); });
it('delivers new offers and responses live to both authorized participants', async () => {
  const a = await socket(customer), b = await socket(worker);
  const pending = Promise.all([nextOffer(a), nextOffer(b)]);
  const sent = await a.timeout(8000).emitWithAck('price-offer:send', { conversation: conversation.id, offer: { amountBututs: 55000 } });
  expect(sent.success).toBe(true); expect((await pending).every(d => d.offer.status === 'OPEN')).toBe(true);
  const replies = Promise.all([nextOffer(a), nextOffer(b)]);
  expect((await respond(sent.data.offer)).status).toBe(200);
  expect((await replies).every(d => d.offer.status === 'ACCEPTED' && d.message.type === 'SYSTEM')).toBe(true);
});
