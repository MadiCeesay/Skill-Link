import mongoose from 'mongoose';
import { JobRequest } from './job.model.js';
import { Quote } from '../quotes/quote.model.js';
import { User } from '../users/user.model.js';
import { activeServices } from '../catalog/catalog.service.js';
import { transaction } from '../../utils/transaction.js';
import { ApiError } from '../../utils/ApiError.js';
import { areaKey } from '../matching/matching.service.js';
import { oid, pageMetadata } from '../discovery/discovery.service.js';
import { jobDTO, effectiveJobStatus } from './job.serializer.js';
export const DAY = 86400000;
export function validateDatePreference(date) {
  if (date && (date < new Date().toISOString().slice(0, 10) || date > new Date(Date.now() + 365 * DAY).toISOString().slice(0, 10))) throw new ApiError(400, 'INVALID_PREFERRED_DATE', 'Scheduling preferences must be within the next year');
}
export function validateExpiry(date, now, maxDate) {
  if (date <= now || date > maxDate) throw new ApiError(400, 'INVALID_EXPIRY', 'Expiry must be in the future and within the allowed lifetime');
}
export async function lockOpenJob(id, session, customer) {
  const now = new Date();
  const job = await JobRequest.findOneAndUpdate({ _id: id, ...(customer ? { customer } : {}), status: 'OPEN', expiresAt: mongoose.trusted({ $gt: now }) }, { $inc: { revision: 1 } }, { new: true, session });
  if (!job) {
    if (!await JobRequest.exists({ _id: id, ...(customer ? { customer } : {}) }).session(session)) throw new ApiError(404, 'NOT_FOUND', 'Job request not found');
    throw new ApiError(409, 'JOB_NOT_OPEN', 'The job is closed or expired');
  }
  if (!await User.exists({ _id: job.customer, role: 'CUSTOMER', accountStatus: 'ACTIVE' }).session(session)) throw new ApiError(409, 'CUSTOMER_INACTIVE', 'This job is unavailable');
  return job;
}
export function jobService(media, matching) {
  async function own(id, customer) {
    const job = await JobRequest.findOne({ _id: id, customer });
    if (!job) throw new ApiError(404, 'NOT_FOUND', 'Job request not found');
    return job;
  }
  async function check(input, customer, now) {
    await activeServices([String(input.service)]);
    await media.ownedMany(input.attachments || [], customer, 'JOB_ATTACHMENT');
    validateDatePreference(input.preferredDate);
    validateExpiry(input.expiresAt, now, new Date(now.getTime() + 30 * DAY));
  }
  return {
    async create(customer, input) {
      const now = new Date();
      const value = { ...input, customer, location: input.location || undefined, expiresAt: input.expiresAt || new Date(now.getTime() + 7 * DAY), areaKey: areaKey(input.serviceArea.name), regionKey: input.serviceArea.region ? areaKey(input.serviceArea.region) : undefined };
      await check(value, customer, now);
      const job = await JobRequest.create(value);
      return { jobRequest: jobDTO(job, true) };
    },
    async own(id, customer) { return { jobRequest: jobDTO(await own(id, customer), true) }; },
    async list(customer, input) {
      const pipeline = [{ $match: { customer: oid(customer) } }, { $set: { effectiveStatus: { $cond: [{ $and: [{ $eq: ['$status', 'OPEN'] }, { $lte: ['$expiresAt', new Date()] }] }, 'EXPIRED', '$status'] } } }];
      if (input.status) pipeline.push({ $match: { effectiveStatus: input.status } });
      pipeline.push({ $facet: { rows: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (input.page - 1) * input.limit }, { $limit: input.limit }], count: [{ $count: 'total' }] } });
      const [result] = await JobRequest.aggregate(pipeline);
      return { jobRequests: result.rows.map(j => jobDTO(j, true)), pagination: pageMetadata(input.page, input.limit, result.count[0]?.total || 0) };
    },
    async update(id, customer, input) {
      return transaction(async session => {
        const job = await lockOpenJob(id, session, customer);
        if (job.quoteCount > 0) throw new ApiError(409, 'JOB_TERMS_LOCKED', 'Job terms cannot change after a quote has been submitted');
        Object.assign(job, input, input.location === null ? { location: undefined } : {});
        job.areaKey = areaKey(job.serviceArea.name); job.regionKey = job.serviceArea.region ? areaKey(job.serviceArea.region) : undefined;
        await check(job, customer, new Date());
        await job.save({ session });
        return { jobRequest: jobDTO(job, true) };
      });
    },
    async cancel(id, customer) {
      return transaction(async session => {
        const job = await lockOpenJob(id, session, customer);
        const now = new Date();
        await Quote.updateMany({ jobRequest: job._id, status: 'PENDING', expiresAt: mongoose.trusted({ $lte: now }) }, { $set: { status: 'EXPIRED' } }, { session });
        await Quote.updateMany({ jobRequest: job._id, status: 'PENDING' }, { $set: { status: 'REJECTED' } }, { session });
        job.status = 'CANCELLED'; await job.save({ session });
        return { jobRequest: jobDTO(job, true) };
      });
    },
    async opportunities(worker, input) {
      const profile = await matching.eligibleProfile(worker);
      const pipeline = [{ $match: matching.opportunityFilter(profile, new Date()) },
        { $lookup: { from: 'users', localField: 'customer', foreignField: '_id', pipeline: [{ $match: { role: 'CUSTOMER', accountStatus: 'ACTIVE' } }, { $project: { _id: 1 } }], as: 'activeCustomer' } },
        { $match: { 'activeCustomer.0': { $exists: true } } },
        { $facet: { rows: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (input.page - 1) * input.limit }, { $limit: input.limit }], count: [{ $count: 'total' }] } }];
      const [result] = await JobRequest.aggregate(pipeline).option({ maxTimeMS: 5000 });
      return { opportunities: result.rows.map(job => jobDTO(job, false, matching.reasons(profile, job))), pagination: pageMetadata(input.page, input.limit, result.count[0]?.total || 0) };
    },
    async opportunity(id, worker) {
      const job = await JobRequest.findById(id);
      if (!job || effectiveJobStatus(job) !== 'OPEN' || !await User.exists({ _id: job.customer, role: 'CUSTOMER', accountStatus: 'ACTIVE' })) throw new ApiError(404, 'NOT_FOUND', 'Job opportunity not found');
      const { match } = await matching.assert(worker, job);
      return { opportunity: jobDTO(job, false, match) };
    },
    async attachment(id, mediaId, user) {
      const job = user.role === 'CUSTOMER' ? await own(id, user._id) : await JobRequest.findById(id);
      if (!job || !job.attachments.some(a => String(a) === mediaId)) throw new ApiError(404, 'NOT_FOUND', 'Attachment not found');
      if (user.role === 'WORKER') await this.opportunity(id, user._id);
      return media.jobAttachment(mediaId, job.customer);
    },
  };
}
