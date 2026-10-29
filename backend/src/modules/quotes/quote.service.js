import mongoose from 'mongoose';
import { Quote } from './quote.model.js';
import { JobRequest } from '../jobRequests/job.model.js';
import { WorkerProfile } from '../workers/worker.model.js';
import { lockOpenJob, validateExpiry, validateDatePreference, DAY } from '../jobRequests/job.service.js';
import { transaction } from '../../utils/transaction.js';
import { ApiError } from '../../utils/ApiError.js';
import { quoteDTO } from './quote.serializer.js';
import { agreementDTO } from '../jobRequests/job.serializer.js';
import { workerCard } from '../discovery/discovery.serializer.js';
import { eligibleWorkerStages, oid, pageMetadata } from '../discovery/discovery.service.js';
export function quoteService(matching, media) {
  function check(quote, job) {
    validateExpiry(quote.expiresAt, new Date(), new Date(Math.min(job.expiresAt.getTime(), Date.now() + 14 * DAY)));
    validateDatePreference(quote.proposedSchedule?.date);
  }
  async function owned(id, worker, session = null) {
    const quote = await Quote.findOne({ _id: id, worker }).session(session);
    if (!quote) throw new ApiError(404, 'NOT_FOUND', 'Quote not found');
    return quote;
  }
  return {
    async submit(jobId, worker, input) {
      try {
        return await transaction(async session => {
          const job = await lockOpenJob(jobId, session);
          await matching.assert(worker, job, session);
          const value = { ...input, jobRequest: job._id, customer: job.customer, worker, expiresAt: input.expiresAt || new Date(Math.min(job.expiresAt.getTime(), Date.now() + 3 * DAY)) };
          check(value, job);
          const [quote] = await Quote.create([value], { session });
          job.quoteCount += 1; await job.save({ session });
          return { quote: quoteDTO(quote, job) };
        });
      } catch (error) { if (error.code === 11000) throw new ApiError(409, 'QUOTE_EXISTS', 'You already submitted a quote for this job'); throw error; }
    },
    async list(worker, input) {
      const filter = { worker };
      const [quotes, total] = await Promise.all([Quote.find(filter).sort({ createdAt: -1, _id: -1 }).skip((input.page - 1) * input.limit).limit(input.limit), Quote.countDocuments(filter)]);
      const jobs = await JobRequest.find({ _id: mongoose.trusted({ $in: quotes.map(q => q.jobRequest) }) });
      const byId = new Map(jobs.map(j => [String(j._id), j]));
      return { quotes: quotes.map(q => quoteDTO(q, byId.get(String(q.jobRequest)))), pagination: pageMetadata(input.page, input.limit, total) };
    },
    async own(id, worker) { const q = await owned(id, worker); return { quote: quoteDTO(q, await JobRequest.findById(q.jobRequest)) }; },
    async change(id, worker, input, withdraw = false) {
      return transaction(async session => {
        const q = await owned(id, worker, session);
        const job = await lockOpenJob(q.jobRequest, session);
        if (q.status !== 'PENDING' || q.expiresAt <= new Date()) throw new ApiError(409, 'QUOTE_NOT_PENDING', 'Only an unexpired pending quote may be changed');
        if (withdraw) q.status = 'WITHDRAWN';
        else { await matching.assert(worker, job, session); Object.assign(q, input); check(q, job); }
        await q.save({ session });
        return { quote: quoteDTO(q, job) };
      });
    },
    async received(jobId, customer, input) {
      const job = await JobRequest.findOne({ _id: jobId, customer });
      if (!job) throw new ApiError(404, 'NOT_FOUND', 'Job request not found');
      const [quotes, total] = await Promise.all([Quote.find({ jobRequest: job._id }).sort({ createdAt: -1, _id: -1 }).skip((input.page - 1) * input.limit).limit(input.limit), Quote.countDocuments({ jobRequest: job._id })]);
      const profiles = await WorkerProfile.aggregate([{ $match: { user: { $in: quotes.map(q => q.worker) } } }, ...eligibleWorkerStages()]);
      const cards = new Map(await Promise.all(profiles.map(async p => [String(p.user), await workerCard(p, media)])));
      return { quotes: quotes.map(q => ({ ...quoteDTO(q, job), workerProfile: cards.get(String(q.worker)) || null })), pagination: pageMetadata(input.page, input.limit, total) };
    },
    async accept(id, customer) {
      return transaction(async session => {
        const quote = await Quote.findOne({ _id: id, customer }).session(session);
        if (!quote) throw new ApiError(404, 'NOT_FOUND', 'Quote not found');
        // Every quote mutation writes this same job first, serializing acceptance,
        // submission, cancellation, and pending-quote edits across API processes.
        const job = await lockOpenJob(quote.jobRequest, session, customer);
        if (quote.status !== 'PENDING' || quote.expiresAt <= new Date()) throw new ApiError(409, 'QUOTE_NOT_PENDING', 'Only a valid pending quote may be accepted');
        try { await matching.assert(quote.worker, job, session); }
        catch (error) { if (error.status === 403) throw new ApiError(409, 'QUOTE_WORKER_INELIGIBLE', 'The quoted worker is no longer marketplace eligible'); throw error; }
        const now = new Date();
        quote.status = 'ACCEPTED'; await quote.save({ session });
        await Quote.updateMany({ jobRequest: job._id, status: 'PENDING', expiresAt: mongoose.trusted({ $lte: now }) }, { $set: { status: 'EXPIRED' } }, { session });
        await Quote.updateMany({ jobRequest: job._id, status: 'PENDING' }, { $set: { status: 'REJECTED' } }, { session });
        job.status = 'QUOTE_ACCEPTED'; job.acceptedQuote = quote._id;
        job.agreement = { customer: job.customer, worker: quote.worker, service: job.service, jobRequest: job._id, acceptedQuote: quote._id,
          agreedAmountBututs: quote.proposedAmountBututs, currency: 'GMD', estimatedDurationMinutes: quote.estimatedDurationMinutes, proposedSchedule: quote.proposedSchedule,
          message: quote.message, jobTitle: job.title, jobDescription: job.description, serviceArea: job.serviceArea, acceptedAt: now };
        await job.save({ session });
        return { quote: quoteDTO(quote, job), agreement: agreementDTO(job.agreement), jobRequest: { id: job.id, status: job.status, acceptedQuote: String(job.acceptedQuote) } };
      });
    },
  };
}
