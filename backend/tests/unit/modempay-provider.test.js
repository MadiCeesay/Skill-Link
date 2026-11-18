import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { ModemPayProvider, intentOutcome } from '../../src/providers/payments/modempay.provider.js';

const ok = data => ({ ok: true, status: 200, json: async () => ({ data }) });
const provider = (extra = {}) => new ModemPayProvider({ secretKey: 'sk_test_abc', webhookSecret: 'whsec_test', frontendOrigin: 'http://localhost:5173', ...extra });
const sign = (body, secret = 'whsec_test') => createHmac('sha512', secret).update(body).digest('hex');

describe('Modem Pay provider', () => {
  it('creates a payment intent with the booking in metadata and return links', async () => {
    const fetchImpl = vi.fn(async () => ok({ id: 'pi_123', payment_link: 'https://test.checkout.modempay.com/abc', status: 'requires_payment_method' }));
    const p = provider({ fetchImpl, callbackUrl: 'https://api.example.com/api/payments/modempay/webhook' });
    const result = await p.createCheckout({ bookingId: 'b1b1b1', paymentId: 'p2p2p2', amountBututs: 65000 });
    expect(result).toEqual({ reference: 'pi_123', redirectUrl: 'https://test.checkout.modempay.com/abc' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.modempay.com/v1/payments');
    expect(init.headers.Authorization).toBe('Bearer sk_test_abc');
    const { data } = JSON.parse(init.body);
    expect(data).toMatchObject({
      amount: 650, currency: 'GMD',
      metadata: { booking_id: 'b1b1b1', payment_id: 'p2p2p2' },
      return_url: 'http://localhost:5173/app/bookings/b1b1b1/payment?modempay=return',
      cancel_url: 'http://localhost:5173/app/bookings/b1b1b1/payment?modempay=cancelled',
      callback_url: 'https://api.example.com/api/payments/modempay/webhook',
    });
  });
  it('can send amounts in bututs instead of dalasi', () => {
    expect(provider({ amountUnit: 'BUTUT' }).toProviderAmount(65050)).toBe(65050);
    expect(provider().toProviderAmount(65050)).toBe(650.5);
  });
  it('reports provider errors without leaking details', async () => {
    const p = provider({ fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: 'bad key' }) }) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(p.createCheckout({ bookingId: 'b', paymentId: 'p', amountBututs: 100 })).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR', status: 502 });
  });
  it('retrieves an intent and maps its status', async () => {
    const p = provider({ fetchImpl: async () => ok({ id: 'pi_1', status: 'succeeded', amount: 650 }) });
    expect(await p.retrieve('pi_1')).toEqual({ outcome: 'SUCCEEDED', status: 'succeeded', amount: 650 });
    expect(intentOutcome('completed')).toBe('SUCCEEDED');
    expect(intentOutcome('cancelled')).toBe('FAILED');
    expect(intentOutcome('requires_payment_method')).toBe('PENDING');
  });
  it('accepts only correctly signed webhooks', () => {
    const body = JSON.stringify({ event: 'charge.succeeded', payload: { amount: 650 } });
    const p = provider();
    expect(p.verifySignature(body, sign(body))).toBe(true);
    expect(p.verifySignature(body, sign(body, 'other-secret'))).toBe(false);
    expect(p.verifySignature(body, '')).toBe(false);
    expect(p.verifySignature(body.replace('650', '1'), sign(body))).toBe(false);
    expect(provider({ webhookSecret: undefined }).verifySignature(body, sign(body))).toBe(false);
  });
  it('also accepts the SDK form where the parsed body is re-serialised', () => {
    const pretty = '{\n  "event": "charge.succeeded",\n  "payload": {}\n}';
    expect(provider().verifySignature(pretty, sign(JSON.stringify(JSON.parse(pretty))))).toBe(true);
  });
});
