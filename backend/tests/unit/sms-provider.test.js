import { describe, it, expect, vi } from 'vitest';
import { SmsToProvider, DisabledSmsProvider, smsText } from '../../src/providers/sms/smsto.provider.js';

describe('SMS.to provider', () => {
  it('sends one message with the API key, number and sender ID', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, message_id: 'm1' }) }));
    const sms = new SmsToProvider({ apiKey: 'key-1', senderId: 'Skill-Link!!', fetchImpl });
    expect(await sms.send({ to: '+2207012345', message: 'Hello' })).toEqual({ delivered: true, id: 'm1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.sms.to/sms/send');
    expect(init.headers.Authorization).toBe('Bearer key-1');
    expect(JSON.parse(init.body)).toEqual({ to: '+2207012345', message: 'Hello', sender_id: 'SkillLink' });
  });
  it('reports a refused message as an error', async () => {
    const sms = new SmsToProvider({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Unauthenticated' }) }) });
    await expect(sms.send({ to: '+2207012345', message: 'x' })).rejects.toThrow('HTTP 401 Unauthenticated');
  });
  it('needs an API key, and the disabled provider sends nothing', async () => {
    expect(() => new SmsToProvider({})).toThrow();
    expect(await new DisabledSmsProvider().send()).toEqual({ delivered: false });
  });
  it('writes short, generic texts only for important events', () => {
    expect(smsText('NEW_QUOTE', 'https://skilllink-gm.vercel.app')).toBe('SkillLink: You received a new offer for your request. Open skilllink-gm.vercel.app');
    expect(smsText('BOOKING_CONFIRMED')).toBe('SkillLink: Your booking is confirmed. Open SkillLink to see it.');
    expect(smsText('NEW_MESSAGE')).toBeNull();
    for (const type of ['NEW_QUOTE', 'QUOTE_ACCEPTED', 'BOOKING_CONFIRMED', 'BOOKING_WORKER_MARKED_COMPLETED', 'PAYMENT_RELEASED'])
      expect(smsText(type, 'https://skilllink-gm.vercel.app').length).toBeLessThanOrEqual(160);
  });
});
