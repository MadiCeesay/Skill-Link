export const canEditJob = (job) =>
  job?.status === 'OPEN' && job.quoteCount === 0;
export const canQuote = (job) => job?.status === 'OPEN';
export const canChangeQuote = (q) =>
  q?.status === 'PENDING' && new Date(q.expiresAt) > new Date();
export const bookingActions = (b, role) =>
  !b
    ? []
    : role === 'CUSTOMER'
      ? {
          AWAITING_PAYMENT: ['pay', 'cancel'],
          CONFIRMED: ['dispute'],
          IN_PROGRESS: ['dispute'],
          WORKER_MARKED_COMPLETED: ['confirm', 'dispute'],
          COMPLETED: ['review'],
        }[b.status] || []
      : role === 'WORKER'
        ? {
            AWAITING_PAYMENT: ['cancel'],
            CONFIRMED:
              new Date(b.scheduledStart) <= new Date() ? ['start'] : [],
            IN_PROGRESS: ['complete'],
          }[b.status] || []
        : [];
export const homeFor = (role) =>
  role === 'ADMIN' ? '/admin' : role === 'WORKER' ? '/work' : '/app';
