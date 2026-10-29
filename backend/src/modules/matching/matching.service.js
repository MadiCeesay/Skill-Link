import { WorkerProfile } from '../workers/worker.model.js';
import { eligibleWorkerStages, oid } from '../discovery/discovery.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { approximateDistance } from '../discovery/discovery.serializer.js';
export const areaKey = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function distanceKm(a, b) {
  const rad = value => value * Math.PI / 180;
  const lat = rad(b[1] - a[1]), lon = rad(b[0] - a[0]);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(lon / 2) ** 2;
  return 6378.1 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function matchingService(maxRadiusKm = 200) {
  return {
    async eligibleProfile(userId, session = null) {
      const query = WorkerProfile.aggregate([{ $match: { user: oid(userId) } }, ...eligibleWorkerStages(), { $match: { trustRank: 1 } }]);
      if (session) query.session(session);
      const [profile] = await query;
      if (!profile) throw new ApiError(403, 'WORKER_INELIGIBLE', 'Quoting requires an active public professional profile and approved identity verification');
      return profile;
    },
    reasons(profile, job) {
      if (String(profile.user) === String(job.customer)) return null;
      if (!profile.services.some(s => String(s) === String(job.service))) return null;
      const area = profile.serviceAreas.some(a => areaKey(a.name) === job.areaKey && a.country === job.serviceArea.country && (!a.region || !job.serviceArea.region || areaKey(a.region) === areaKey(job.serviceArea.region)));
      if (!area) return null;
      const reasons = ['OFFERS_SERVICE', 'SERVES_AREA', 'IDENTITY_APPROVED'];
      let proximity;
      if (profile.primaryLocation && job.location) {
        const km = distanceKm(profile.primaryLocation.coordinates, job.location.coordinates);
        if (km > Math.min(profile.serviceRadiusKm, maxRadiusKm)) return null;
        proximity = approximateDistance(km * 1000);
        reasons.push('WITHIN_SERVICE_RADIUS');
      }
      return { reasons, ...(proximity === undefined ? {} : { approximateDistanceKm: proximity }) };
    },
    async assert(userId, job, session = null) {
      const profile = await this.eligibleProfile(userId, session);
      const match = this.reasons(profile, job);
      if (!match) throw new ApiError(403, 'JOB_NOT_RELEVANT', 'This job does not match your service and service area');
      return { profile, match };
    },
    opportunityFilter(profile, now) {
      const areas = profile.serviceAreas.map(a => ({ areaKey: areaKey(a.name), 'serviceArea.country': a.country,
        ...(a.region ? { $or: [{ regionKey: areaKey(a.region) }, { regionKey: null }] } : {}) }));
      const and = [{ $or: areas }];
      if (profile.primaryLocation) and.push({ $or: [{ location: null }, { location: { $geoWithin: { $centerSphere: [profile.primaryLocation.coordinates, Math.min(profile.serviceRadiusKm, maxRadiusKm) / 6378.1] } } }] });
      return { status: 'OPEN', expiresAt: { $gt: now }, service: { $in: profile.services }, customer: { $ne: profile.user }, $and: and };
    },
  };
}
