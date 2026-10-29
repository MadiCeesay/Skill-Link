import { approximateDistance } from '../discovery/discovery.serializer.js';
export const effectiveJobStatus = (job, now = new Date()) => job.status === 'OPEN' && job.expiresAt <= now ? 'EXPIRED' : job.status;
export function agreementDTO(a) {
  if (!a) return null;
  return { customer: String(a.customer), worker: String(a.worker), service: String(a.service), jobRequest: String(a.jobRequest), acceptedQuote: String(a.acceptedQuote),
    agreedAmountBututs: a.agreedAmountBututs, currency: a.currency, estimatedDurationMinutes: a.estimatedDurationMinutes,
    proposedSchedule: a.proposedSchedule?.date ? { date: a.proposedSchedule.date, note: a.proposedSchedule.note } : null,
    message: a.message, jobTitle: a.jobTitle, jobDescription: a.jobDescription, serviceArea: areaDTO(a.serviceArea), acceptedAt: a.acceptedAt };
}
export const areaDTO = a => ({ name: a.name, region: a.region, country: a.country });
export function budgetDTO(b) { return { type: b.type, currency: b.currency, ...(b.type === 'FIXED' ? { amountBututs: b.amountBututs } : b.type === 'RANGE' ? { minAmountBututs: b.minAmountBututs, maxAmountBututs: b.maxAmountBututs } : {}) }; }
export function jobDTO(job, own = false, match) {
  return { id: String(job._id), service: String(job.service), title: job.title, description: job.description, serviceArea: areaDTO(job.serviceArea),
    preferredDate: job.preferredDate, preferredTimeNote: job.preferredTimeNote, budget: budgetDTO(job.budget),
    attachments: job.attachments.map(String), status: effectiveJobStatus(job), quoteCount: job.quoteCount, expiresAt: job.expiresAt, createdAt: job.createdAt, updatedAt: job.updatedAt,
    ...(match ? { match } : {}), ...(own ? { customer: String(job.customer), location: job.location ? { type: 'Point', coordinates: [...job.location.coordinates] } : null,
      privateAddress: job.privateAddress, acceptedQuote: job.acceptedQuote ? String(job.acceptedQuote) : null, agreement: agreementDTO(job.agreement) } : {}) };
}
