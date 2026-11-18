import mongoose from 'mongoose';
import { WorkerProfile } from '../workers/worker.model.js';
import { workerCard, approximateDistance } from './discovery.serializer.js';
import { verificationSummary } from '../workers/worker.serializer.js';
import { scoreWorker, compareRanked } from '../ranking/ranking.score.js';
import { responseStatsFor } from '../ranking/response-stats.js';
// "Recommended" scores candidates in application code so the formula lives in one
// readable place (ranking.score.js). Matching profiles beyond this cap are not ranked.
export const RANKING_CANDIDATE_LIMIT = 500;
export const oid = value => new mongoose.Types.ObjectId(value);
export const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Shared eligibility pipeline: no private User fields are loaded by the lookups.
export function eligibleWorkerStages() {
  return [
    { $match: { profileVisibility: 'PUBLIC', professionTitle: { $ne: '' }, 'services.0': { $exists: true }, 'serviceAreas.0': { $exists: true }, $expr: { $gte: [{ $strLenCP: '$bio' }, 20] } } },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', pipeline: [{ $match: { role: 'WORKER', accountStatus: 'ACTIVE' } }, { $project: { firstName: 1, lastName: 1 } }], as: 'marketplaceUser' } },
    { $unwind: '$marketplaceUser' },
    { $lookup: { from: 'services', localField: 'services', foreignField: '_id', pipeline: [
      { $match: { isActive: true } }, { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', pipeline: [{ $match: { isActive: true } }, { $project: { _id: 1 } }], as: 'activeCategory' } },
      { $match: { 'activeCategory.0': { $exists: true } } }, { $project: { name: 1, slug: 1, category: 1 } },
    ], as: 'marketplaceServices' } },
    { $match: { $expr: { $eq: [{ $size: '$services' }, { $size: '$marketplaceServices' }] } } },
    { $lookup: { from: 'verifications', localField: 'user', foreignField: 'worker', pipeline: [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 1 }, { $project: { status: 1, workEvidenceReviewed: 1, workEvidence: 1 } }], as: 'marketplaceVerification' } },
    { $set: { marketplaceVerification: { $ifNull: [{ $arrayElemAt: ['$marketplaceVerification', 0] }, null] } } },
    { $set: { trustRank: { $cond: [{ $eq: ['$marketplaceVerification.status', 'APPROVED'] }, 1, 0] } } },
  ];
}
export const pageMetadata = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total });
export function discoveryService(media) {
  // Scores every matching worker, sorts by score and returns the requested page.
  async function recommended(pipeline, input) {
    pipeline.push({ $facet: { rows: [{ $sort: { _id: 1 } }, { $limit: RANKING_CANDIDATE_LIMIT }], count: [{ $count: 'total' }] } });
    const [result] = await WorkerProfile.aggregate(pipeline).option({ maxTimeMS: 5000 });
    const responses = await responseStatsFor(result.rows.map(p => p.user));
    const ranked = result.rows.map(profile => {
      const trust = verificationSummary(profile.marketplaceVerification);
      const hasDistance = profile.distanceMeters !== undefined;
      const ranking = scoreWorker({
        distanceKm: hasDistance ? profile.distanceMeters / 1000 : null,
        approximateDistanceKm: hasDistance ? approximateDistance(profile.distanceMeters) : undefined,
        averageRating: profile.averageRating || 0,
        reviewCount: profile.reviewCount || 0,
        completedJobs: profile.completedJobsCount || 0,
        identityVerified: trust.identityVerified,
        workEvidenceReviewed: trust.workEvidenceReviewed,
        availableNow: Boolean(profile.availableNow),
        responses: responses.get(String(profile.user)) || { received: 0, responded: 0, averageMinutes: null },
      });
      return { id: profile._id, profile, ranking };
    }).sort(compareRanked);
    const page = ranked.slice((input.page - 1) * input.limit, input.page * input.limit);
    const workers = await Promise.all(page.map(async ({ profile, ranking }) => ({
      ...(await workerCard(profile, media)),
      // Only the score and the plain-language reasons leave the server.
      recommendation: { score: ranking.score, reasons: ranking.reasons },
    })));
    return { workers, pagination: pageMetadata(input.page, input.limit, Math.min(result.count[0]?.total || 0, RANKING_CANDIDATE_LIMIT)) };
  }
  return {
    async search(input) {
      const pipeline = [];
      const candidate = { profileVisibility: 'PUBLIC', ...(input.service ? { services: oid(input.service) } : {}) };
      if (input.longitude !== undefined) pipeline.push({ $geoNear: { near: { type: 'Point', coordinates: [input.longitude, input.latitude] }, key: 'primaryLocation', query: candidate, spherical: true, maxDistance: input.radiusKm * 1000, distanceField: 'distanceMeters' } });
      else pipeline.push({ $match: candidate });
      pipeline.push(...eligibleWorkerStages());
      const match = {};
      if (input.category && input.service) match.marketplaceServices = { $elemMatch: { _id: oid(input.service), category: oid(input.category) } };
      else if (input.category) match['marketplaceServices.category'] = oid(input.category);
      if (input.area) match['serviceAreas.name'] = { $regex: '^' + escapeRegex(input.area) + '$', $options: 'i' };
      if (input.verified !== undefined) match.trustRank = input.verified ? 1 : 0;
      if (input.availableNow !== undefined) match.availableNow = input.availableNow;
      if (input.minRating !== undefined) match.averageRating = { $gte: input.minRating };
      if (input.q) { const regex = { $regex: escapeRegex(input.q), $options: 'i' }; match.$or = [{ professionTitle: regex }, { skills: regex }, { 'marketplaceServices.name': regex }]; }
      if (input.pricingType) match.pricing = { $elemMatch: { type: input.pricingType, ...(input.service ? { service: oid(input.service) } : {}) } };
      pipeline.push({ $match: match });
      if (input.sort === 'price') pipeline.push({ $set: { sortPrice: { $arrayElemAt: [{ $map: { input: { $filter: { input: '$pricing', as: 'price', cond: { $and: [{ $eq: ['$$price.service', oid(input.service)] }, { $eq: ['$$price.type', input.pricingType] }] } } }, as: 'price', in: '$$price.amountBututs' } }, 0] } } });
      const sorts = { relevance: input.longitude === undefined ? { trustRank: -1, _id: 1 } : { distanceMeters: 1, _id: 1 }, distance: { distanceMeters: 1, _id: 1 }, trust: { trustRank: -1, _id: 1 }, rating: { averageRating: -1, reviewCount: -1, _id: 1 }, price: { sortPrice: 1, _id: 1 } };
      if (input.sort === 'recommended') return recommended(pipeline, input);
      pipeline.push({ $facet: { rows: [{ $sort: sorts[input.sort] }, { $skip: (input.page - 1) * input.limit }, { $limit: input.limit }], count: [{ $count: 'total' }] } });
      const [result] = await WorkerProfile.aggregate(pipeline).option({ maxTimeMS: 5000 });
      return { workers: await Promise.all(result.rows.map(p => workerCard(p, media))), pagination: pageMetadata(input.page, input.limit, result.count[0]?.total || 0) };
    },
  };
}
