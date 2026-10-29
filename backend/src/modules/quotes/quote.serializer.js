export function effectiveQuoteStatus(quote, job, now = new Date()) {
  if (quote.status !== 'PENDING') return quote.status;
  if (quote.expiresAt <= now || (job.status === 'OPEN' && job.expiresAt <= now) || job.status === 'EXPIRED') return 'EXPIRED';
  return job.status === 'OPEN' ? 'PENDING' : 'REJECTED';
}
export function quoteDTO(q, job) {
  return { id: String(q._id), jobRequest: String(q.jobRequest), worker: String(q.worker), proposedAmountBututs: q.proposedAmountBututs, currency: q.currency,
    message: q.message, estimatedDurationMinutes: q.estimatedDurationMinutes, proposedSchedule: q.proposedSchedule ? { date: q.proposedSchedule.date, note: q.proposedSchedule.note } : null,
    status: effectiveQuoteStatus(q, job), expiresAt: q.expiresAt, createdAt: q.createdAt, updatedAt: q.updatedAt };
}
