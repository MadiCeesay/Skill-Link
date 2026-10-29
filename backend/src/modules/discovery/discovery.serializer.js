import { verificationSummary } from '../workers/worker.serializer.js';
export const approximateDistance = meters => Math.max(5, Math.ceil(meters / 5000) * 5);
export async function workerCard(profile, media) {
  const verification = profile.marketplaceVerification || null;
  return { workerId: String(profile.user), profileId: String(profile._id),
    name: { firstName: profile.marketplaceUser.firstName, lastName: profile.marketplaceUser.lastName },
    profileImage: await media.publicImage(profile.profileImage), professionTitle: profile.professionTitle,
    services: profile.marketplaceServices.map(s => ({ id: String(s._id), category: String(s.category), name: s.name, slug: s.slug })),
    serviceAreas: profile.serviceAreas.map(a => ({ name: a.name, region: a.region, country: a.country })),
    verificationSummary: verificationSummary(verification),
    pricing: profile.pricing.map(p => ({ service: String(p.service), type: p.type, ...(p.amountBututs === undefined ? {} : { amountBututs: p.amountBututs }), currency: p.currency })),
    averageRating: profile.averageRating, reviewCount: profile.reviewCount, completedJobsCount: profile.completedJobsCount, availableNow: profile.availableNow,
    ...(profile.distanceMeters === undefined ? {} : { approximateDistanceKm: approximateDistance(profile.distanceMeters) }) };
}
