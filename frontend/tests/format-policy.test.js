import { describe, it, expect } from 'vitest';
import {
  money,
  gmdInput,
  bututs,
  dateTime,
  toUTC,
  pricing,
  budget,
  statusLabel,
  displayName,
} from '../src/utils/format';
import {
  canEditJob,
  canChangeQuote,
  bookingActions,
  homeFor,
} from '../src/utils/policy';
describe('Integer GMD display and input', () => {
  it('preserves the last butut of the largest accepted amount in edit fields', () => {
    expect(gmdInput(Number.MAX_SAFE_INTEGER)).toBe('90071992547409.91');
    expect(bututs(gmdInput(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(gmdInput(0)).toBe('0.00');
    expect(gmdInput(undefined)).toBe('');
  });
  it.each([
    [250000, 'GMD 2,500.00'],
    [0, 'GMD 0.00'],
    [123, 'GMD 1.23'],
    ['900719925474099300', 'GMD 9,007,199,254,740,993.00'],
  ])('formats %s precisely', (v, expected) => expect(money(v)).toBe(expected));
  it.each([
    ['0', 0],
    ['1.05', 105],
    ['2500', 250000],
    ['12.1', 1210],
  ])('parses %s without float arithmetic', (v, expected) =>
    expect(bututs(v)).toBe(expected),
  );
  it.each(['-1', '1.001', 'NaN', '1e4', '9007199254740992', ''])(
    'rejects invalid money %s',
    (v) => expect(() => bututs(v)).toThrow(),
  );
  it('does not show raw bututs for service pricing', () => {
    expect(pricing({ type: 'HOURLY', amountBututs: 15000 })).toBe(
      'GMD 150.00 / hour',
    );
    expect(pricing({ type: 'QUOTE_REQUIRED' })).toBe('Quote on request');
    expect(
      budget({ type: 'RANGE', minAmountBututs: 10000, maxAmountBututs: 25000 }),
    ).toBe('GMD 100.00 – GMD 250.00');
  });
});
describe('Role and lifecycle presentation', () => {
  it('locks job edits after the first quote', () => {
    expect(canEditJob({ status: 'OPEN', quoteCount: 0 })).toBe(true);
    expect(canEditJob({ status: 'OPEN', quoteCount: 1 })).toBe(false);
    expect(canEditJob({ status: 'QUOTE_ACCEPTED', quoteCount: 0 })).toBe(false);
  });
  it('offers quote management only while pending and unexpired', () => {
    expect(canChangeQuote({ status: 'PENDING', expiresAt: '2099-01-01' })).toBe(
      true,
    );
    expect(
      canChangeQuote({ status: 'ACCEPTED', expiresAt: '2099-01-01' }),
    ).toBe(false);
    expect(canChangeQuote({ status: 'PENDING', expiresAt: '2000-01-01' })).toBe(
      false,
    );
  });
  it.each([
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS',
    'WORKER_MARKED_COMPLETED',
    'CANCELLED',
    'DISPUTED',
  ])('does not offer reviews for %s', (status) =>
    expect(bookingActions({ status }, 'CUSTOMER')).not.toContain('review'),
  );
  it('offers customer confirmation and problems only at eligible stages', () => {
    expect(
      bookingActions({ status: 'WORKER_MARKED_COMPLETED' }, 'CUSTOMER'),
    ).toEqual(['confirm', 'dispute']);
    expect(bookingActions({ status: 'COMPLETED' }, 'CUSTOMER')).toEqual([
      'review',
    ]);
  });
  it('workers cannot start before scheduled time or confirm customer completion', () => {
    expect(
      bookingActions(
        { status: 'CONFIRMED', scheduledStart: '2099-01-01' },
        'WORKER',
      ),
    ).toEqual([]);
    expect(bookingActions({ status: 'IN_PROGRESS' }, 'WORKER')).toEqual([
      'complete',
    ]);
    expect(bookingActions({ status: 'COMPLETED' }, 'WORKER')).toEqual([]);
  });
  it('routes roles to separate workspaces', () => {
    expect(homeFor('WORKER')).toBe('/work');
    expect(homeFor('CUSTOMER')).toBe('/app');
    expect(homeFor('ADMIN')).toBe('/admin');
  });
  it('uses customer-friendly status labels', () =>
    expect(statusLabel('WORKER_MARKED_COMPLETED')).toBe(
      'Awaiting your confirmation',
    ));
  it('formats Africa/Banjul consistently and submits UTC', () => {
    expect(toUTC('2027-01-04T09:00')).toBe('2027-01-04T09:00:00.000Z');
    expect(dateTime('2027-01-04T09:00:00Z')).toContain('09:00');
  });
  it('supports public DTO and authenticated names', () => {
    expect(displayName({ name: { firstName: 'Awa', lastName: 'Sowe' } })).toBe(
      'Awa Sowe',
    );
    expect(displayName({ firstName: 'Lamin', lastName: 'Jallow' })).toBe(
      'Lamin Jallow',
    );
  });
});
