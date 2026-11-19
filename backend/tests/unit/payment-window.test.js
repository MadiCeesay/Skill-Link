import { describe, it, expect } from 'vitest';
import { assertPayable } from '../../src/modules/payments/payment.service.js';

const now = new Date('2026-11-19T01:20:00Z');
const minutes = (m) => new Date(now.getTime() + m * 60000);
const booking = (extra = {}) => ({
  status: 'AWAITING_PAYMENT',
  reservationExpiresAt: minutes(10),
  scheduledStart: minutes(-8),
  scheduledEnd: minutes(52),
  ...extra,
});
const code = (b) => {
  try { assertPayable(b, now); return 'OK'; } catch (e) { return e.code; }
};

describe('assertPayable', () => {
  it('accepts a booking whose start time has passed while the hold and the job are open', () => {
    expect(code(booking())).toBe('OK');
  });
  it('reports an expired hold', () => {
    expect(code(booking({ reservationExpiresAt: minutes(-1) }))).toBe('RESERVATION_EXPIRED');
  });
  it('reports a paid booking', () => {
    expect(code(booking({ status: 'CONFIRMED' }))).toBe('BOOKING_ALREADY_PAID');
  });
  it('reports a cancelled booking', () => {
    expect(code(booking({ status: 'CANCELLED' }))).toBe('BOOKING_CLOSED');
  });
  it('reports a booking whose time is over', () => {
    expect(code(booking({ scheduledEnd: minutes(-1) }))).toBe('BOOKING_CLOSED');
  });
});
