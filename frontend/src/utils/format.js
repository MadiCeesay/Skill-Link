export const displayName = (p) =>
  p?.name
    ? [p.name.firstName, p.name.lastName].filter(Boolean).join(' ')
    : [p?.firstName, p?.lastName].filter(Boolean).join(' ');
export function money(value) {
  if (value === undefined || value === null || value === '')
    return 'Price on request';
  let n;
  try {
    n = BigInt(value);
  } catch {
    return 'Price on request';
  }
  const sign = n < 0n ? '-' : '';
  if (n < 0n) n = -n;
  return (
    'GMD ' +
    sign +
    (n / 100n).toLocaleString('en-GB') +
    '.' +
    String(n % 100n).padStart(2, '0')
  );
}
export function gmdInput(value) {
  if (value === undefined || value === null) return '';
  const amount = BigInt(value);
  return String(amount / 100n) + '.' + String(amount % 100n).padStart(2, '0');
}
export function bututs(value) {
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error(
      'Enter a non-negative GMD amount with at most two decimal places.',
    );
  const [a, b = ''] = s.split('.');
  const n = BigInt(a) * 100n + BigInt(b.padEnd(2, '0'));
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('This amount is too large.');
  return Number(n);
}
export const date = (value, options = {}) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Banjul',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...options,
      }).format(new Date(value))
    : 'Not specified';
export const dateTime = (value) =>
  date(value, { hour: '2-digit', minute: '2-digit' });
export const toUTC = (value) =>
  value ? new Date(value + ':00Z').toISOString() : undefined;
export const localInput = (value) =>
  value ? new Date(value).toISOString().slice(0, 16) : '';
export const title = (value) =>
  String(value || '')
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const statusLabel = (value) =>
  ({
    AWAITING_PAYMENT: 'Payment required',
    PENDING: 'Pending',
    WORKER_MARKED_COMPLETED: 'Awaiting your confirmation',
    HELD: 'Held · simulated',
    QUOTE_ACCEPTED: 'Quote accepted',
    QUOTED: 'Quote received',
    NOT_SUBMITTED: 'Not submitted',
  })[value] || title(value);
export function pricing(p) {
  if (!p || p.type === 'QUOTE_REQUIRED') return 'Quote on request';
  return (
    (p.type === 'STARTING_FROM' ? 'From ' : '') +
    money(p.amountBututs) +
    (p.type === 'HOURLY' ? ' / hour' : '')
  );
}
export const budget = (b) =>
  !b || b.type === 'OPEN_TO_QUOTES'
    ? 'Open to quotes'
    : b.type === 'RANGE'
      ? money(b.minAmountBututs) + ' – ' + money(b.maxAmountBututs)
      : money(b.amountBututs);
export const shortId = (id) => (id ? String(id).slice(-6).toUpperCase() : '');
