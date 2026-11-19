export const canEditJob = (job) =>
  job?.status === 'OPEN' && job.quoteCount === 0;
export const canQuote = (job) => job?.status === 'OPEN';
export const canChangeQuote = (q) =>
  q?.status === 'PENDING' && new Date(q.expiresAt) > new Date();
// True while the customer can still pay: unpaid, hold not run out, job time not over.
// Mirrors the server check so a stale page never offers a payment the server will refuse.
export const paymentOpen = (b, now = new Date()) =>
  b?.status === 'AWAITING_PAYMENT' &&
  (!b.reservationExpiresAt || new Date(b.reservationExpiresAt) > now) &&
  (!b.scheduledEnd || new Date(b.scheduledEnd) > now);
export const bookingActions = (b, role) =>
  !b
    ? []
    : role === 'CUSTOMER'
      ? {
          AWAITING_PAYMENT: paymentOpen(b) ? ['pay', 'cancel'] : [],
          CONFIRMED: ['dispute'],
          IN_PROGRESS: ['dispute'],
          WORKER_MARKED_COMPLETED: ['confirm', 'dispute'],
          COMPLETED: ['review'],
        }[b.status] || []
      : role === 'WORKER'
        ? {
            AWAITING_PAYMENT: paymentOpen(b) ? ['cancel'] : [],
            CONFIRMED:
              new Date(b.scheduledStart) <= new Date() ? ['start'] : [],
            IN_PROGRESS: ['complete'],
          }[b.status] || []
        : [];
export const homeFor = (role) =>
  role === 'ADMIN' ? '/admin' : role === 'WORKER' ? '/work' : '/app';
