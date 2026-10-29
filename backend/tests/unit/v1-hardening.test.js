import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { availabilityWrite } from '../../src/modules/availability/availability.validator.js';
import { withinAvailability } from '../../src/modules/availability/availability.service.js';
import { hasContact } from '../../src/modules/conversations/contact.service.js';
import { audioFormat } from '../../src/modules/media/audio.validator.js';
const environment = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
  JWT_ACCESS_SECRET: 'test-access-secret-12345678901234567890',
  JWT_REFRESH_SECRET: 'test-refresh-secret-12345678901234567890',
  FRONTEND_ORIGIN: 'http://localhost:5173',
};
describe('V1 scheduling, contact and environment hardening', () => {
  it('uses bounded safe simulation defaults', () => {
    const c = loadConfig(environment);
    expect(c.BOOKING_RESERVATION_MINUTES).toBe(15);
    expect(c.COMMISSION_BASIS_POINTS).toBe(1000);
    expect(c.PAYMENT_PROVIDER).toBe('mock');
    expect(c.EMAIL_PROVIDER).toBe('disabled');
    expect(c.TRUST_PROXY_HOPS).toBe(0);
  });
  it.each([
    ['BOOKING_RESERVATION_MINUTES', 0],
    ['BOOKING_RESERVATION_MINUTES', 61],
    ['COMMISSION_BASIS_POINTS', -1],
    ['COMMISSION_BASIS_POINTS', 10001],
    ['COMMISSION_BASIS_POINTS', 1.5],
    ['PAYMENT_PROVIDER', 'stripe'],
    ['EMAIL_PROVIDER', 'unconfigured'],
    ['TRUST_PROXY_HOPS', true],
    ['TRUST_PROXY_HOPS', 6],
  ])('rejects invalid %s=%s', (name, value) => {
    if (name === 'TRUST_PROXY_HOPS' && value === true) value = 'true';
    expect(() => loadConfig({ ...environment, [name]: value })).toThrow();
  });
  it('rejects impossible blocked dates', () =>
    expect(
      availabilityWrite.safeParse({ weekly: [], blockedDates: ['2027-02-30'] })
        .success,
    ).toBe(false));
  it('rejects reversed time off', () =>
    expect(
      availabilityWrite.safeParse({
        weekly: [],
        timeOff: [
          { start: '2027-01-02T12:00:00Z', end: '2027-01-02T10:00:00Z' },
        ],
      }).success,
    ).toBe(false));
  it('checks Banjul civil times and excludes cross-midnight bookings', () => {
    const a = {
      weekly: [{ day: 1, start: '08:00', end: '20:00' }],
      blockedDates: [],
      timeOff: [],
    };
    expect(
      withinAvailability(
        a,
        new Date('2027-01-04T09:00:00Z'),
        new Date('2027-01-04T10:00:00Z'),
      ),
    ).toBe(true);
    expect(
      withinAvailability(
        a,
        new Date('2027-01-04T19:00:00Z'),
        new Date('2027-01-05T01:00:00Z'),
      ),
    ).toBe(false);
  });
  it.each([
    'GMD 7100001',
    'Price 7100001 bututs',
    '7100001 bricks',
    'Room 3.5 x 4 metres',
    '20 bags cost GMD 1500',
    'https://example.org/product-manual',
  ])('permits labelled work content: %s', (text) =>
    expect(hasContact(text)).toBe(false),
  );
  it.each([
    '+220 710 00 01',
    '00220 7100001',
    '7100001',
    'a@example.test',
    'https://wa.me/2207100001',
    'instagram.com/name',
    '７１００００１',
  ])('detects obvious normalized contact: %s', (text) =>
    expect(hasContact(text)).toBe(true),
  );
  it.each(['audio/ogg', 'audio/webm', 'audio/wav', 'application/octet-stream'])(
    'rejects malformed audio %s',
    (mime) =>
      expect(() =>
        audioFormat(Buffer.from('invalid executable content'), mime),
      ).toThrow(),
  );
});
