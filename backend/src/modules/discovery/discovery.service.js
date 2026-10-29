import mongoose from 'mongoose';
import { WorkerProfile } from '../workers/worker.model.js';
import { workerCard } from './discovery.serializer.js';
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
      pipeline.push({ $facet: { rows: [{ $sort: sorts[input.sort] }, { $skip: (input.page - 1) * input.limit }, { $limit: input.limit }], count: [{ $count: 'total' }] } });
      const [result] = await WorkerProfile.aggregate(pipeline).option({ maxTimeMS: 5000 });
      return { workers: await Promise.all(result.rows.map(p => workerCard(p, media))), pagination: pageMetadata(input.page, input.limit, result.count[0]?.total || 0) };
    },
  };
}
