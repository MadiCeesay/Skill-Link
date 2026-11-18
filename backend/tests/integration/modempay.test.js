import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from '../helpers/mongo-memory.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { Booking } from '../../src/modules/bookings/booking.model.js';
import { Payment, PaymentAttempt, FinancialLedgerEntry } from '../../src/modules/payments/payment.model.js';
import { ModemPayProvider } from '../../src/providers/payments/modempay.provider.js';
import { FakeMediaProvider } from '../helpers/fake-media.provider.js';

const SECRET = 'whsec_integration_test';
let mongo, config, customer, worker, other, booking, intents, fetchImpl, app;
const hours = n => new Date(Date.now() + n * 3600000);
const sign = body => createHmac('sha512', SECRET).update(body).digest('hex');

// A fake Modem Pay API: remembers created intents and lets the test choose their status.
function fakeModemPay() {
  intents = new Map();
  return vi.fn(async (url, init) => {
    if (init.method === 'POST') {
      const id = 'pi_' + (intents.size + 1);
      intents.set(id, { id, status: 'requires_payment_method', amount: JSON.parse(init.body).data.amount, body: JSON.parse(init.body).data });
      return { ok: true, status: 200, json: async () => ({ data: { id, payment_link: 'https://test.checkout.modempay.com/' + id } }) };
    }
    const intent = intents.get(decodeURIComponent(url.split('/').pop()));
    return intent ? { ok: true, status: 200, json: async () => ({ data: intent }) } : { ok: false, status: 404, json: async () => ({}) };
  });
}
async function login(user) {
  const r = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Test-password123' });
  return r.body.data.accessToken;
}
const checkout = async (user = customer, key = 'checkout-key-1') =>
  request(app).post('/api/payments/bookings/' + booking._id + '/checkout').set('Authorization', 'Bearer ' + await login(user)).send({ idempotencyKey: key });
const webhook = (event, payload, signature) => {
  const body = JSON.stringify({ event, payload });
  return request(app).post('/api/payments/modempay/webhook').set('Content-Type', 'application/json').set('x-modem-signature', signature ?? sign(body)).send(body);
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_ACCESS_SECRET: 'modempay-access-test-secret-not-production-1', JWT_REFRESH_SECRET: 'modempay-refresh-test-secret-not-production-2', FRONTEND_ORIGIN: 'http://localhost:5173' });
  await connectDatabase(config.MONGODB_URI); await ensureIndexes();
  const person = (role, i) => User.create({ firstName: role + i, lastName: 'Pay', email: 'pay-' + i + '@example.test', phoneNumber: '+220750000' + i, password: 'Test-password123', role });
  customer = await person('CUSTOMER', 1); worker = await person('WORKER', 2); other = await person('CUSTOMER', 3);
});
beforeEach(async () => {
  for (const Model of [Booking, Payment, PaymentAttempt, FinancialLedgerEntry]) await Model.deleteMany({});
  booking = await Booking.create({ customer: customer._id, worker: worker._id, service: new mongoose.Types.ObjectId(), description: 'Fix the roof leak',
    scheduledStart: hours(48), scheduledEnd: hours(50), agreedAmountBututs: 65000, status: 'AWAITING_PAYMENT', reservationExpiresAt: hours(1) });
  fetchImpl = fakeModemPay();
  const provider = new ModemPayProvider({ secretKey: 'sk_test_x', webhookSecret: SECRET, frontendOrigin: config.FRONTEND_ORIGIN, fetchImpl });
  app = createApp(config, { paymentProvider: provider, mediaProvider: new FakeMediaProvider(), authLimit: 10000, globalLimit: 10000, paymentLimit: 10000 });
});
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });

describe('Modem Pay checkout', () => {
  it('tells the app which provider is active', async () => {
    const r = await request(app).get('/api/payments/provider').set('Authorization', 'Bearer ' + await login(customer));
    expect(r.body.data).toEqual({ provider: 'modempay', redirects: true });
  });

  it('creates a pending payment and returns the Modem Pay checkout link', async () => {
    const r = await checkout();
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.redirectUrl).toBe('https://test.checkout.modempay.com/pi_1');
    expect(r.body.data.payment).toMatchObject({ status: 'PENDING', amountBututs: 65000 });
    const created = intents.get('pi_1').body;
    expect(created).toMatchObject({ amount: 650, currency: 'GMD', metadata: { booking_id: String(booking._id) } });
    expect((await Booking.findById(booking._id)).status).toBe('AWAITING_PAYMENT');
    // Same idempotency key: same link, no second intent.
    const again = await checkout();
    expect(again.body.data).toMatchObject({ redirectUrl: 'https://test.checkout.modempay.com/pi_1', idempotent: true });
    expect(intents.size).toBe(1);
  });

  it('confirms the booking and holds the money when a signed charge.succeeded arrives', async () => {
    const { body } = await checkout();
    const paymentId = body.data.payment.id;
    const r = await webhook('charge.succeeded', { payment_intent_id: 'pi_1', amount: 650, metadata: { payment_id: paymentId, booking_id: String(booking._id) } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await Payment.findById(paymentId)).status).toBe('HELD');
    expect((await Booking.findById(booking._id)).status).toBe('CONFIRMED');
    expect(await FinancialLedgerEntry.countDocuments({ payment: paymentId })).toBe(3);
    // Duplicate delivery changes nothing.
    await webhook('charge.succeeded', { payment_intent_id: 'pi_1', amount: 650, metadata: { payment_id: paymentId } });
    expect(await FinancialLedgerEntry.countDocuments({ payment: paymentId })).toBe(3);
  });

  it('rejects webhooks with a wrong signature or the wrong amount', async () => {
    const { body } = await checkout();
    const paymentId = body.data.payment.id;
    expect((await webhook('charge.succeeded', { amount: 650, metadata: { payment_id: paymentId } }, 'f'.repeat(128))).status).toBe(400);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await webhook('charge.succeeded', { amount: 1, metadata: { payment_id: paymentId } })).status).toBe(409);
    expect((await Payment.findById(paymentId)).status).toBe('PENDING');
    expect((await Booking.findById(booking._id)).status).toBe('AWAITING_PAYMENT');
  });

  it('marks the payment failed on charge.failed and lets the customer try again', async () => {
    const { body } = await checkout();
    await webhook('charge.failed', { metadata: { payment_id: body.data.payment.id } });
    expect((await Payment.findById(body.data.payment.id)).status).toBe('FAILED');
    const retry = await checkout(customer, 'checkout-key-2');
    expect(retry.body.data.redirectUrl).toBe('https://test.checkout.modempay.com/pi_2');
  });

  it('checks the status with Modem Pay when the customer returns (works without webhooks)', async () => {
    const { body } = await checkout();
    const token = await login(customer);
    const pending = await request(app).post('/api/payments/bookings/' + booking._id + '/verify').set('Authorization', 'Bearer ' + token).send({});
    expect(pending.body.data.payment.status).toBe('PENDING');
    intents.get('pi_1').status = 'succeeded';
    const paid = await request(app).post('/api/payments/bookings/' + booking._id + '/verify').set('Authorization', 'Bearer ' + token).send({});
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    expect(paid.body.data.payment.status).toBe('HELD');
    expect((await Booking.findById(booking._id)).status).toBe('CONFIRMED');
    expect(body.data.payment.id).toBe(paid.body.data.payment.id);
  });

  it('only lets the booking customer start or verify a payment', async () => {
    expect((await checkout(other)).status).toBe(404);
    const r = await request(app).post('/api/payments/bookings/' + booking._id + '/verify').set('Authorization', 'Bearer ' + await login(other)).send({});
    expect(r.status).toBe(404);
  });
});
