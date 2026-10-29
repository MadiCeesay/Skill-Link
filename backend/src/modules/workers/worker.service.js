import { WorkerProfile } from './worker.model.js';
import { User } from '../users/user.model.js';
import { Verification } from '../verifications/verification.model.js';
import { activeServices, serviceDTO } from '../catalog/catalog.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { ownProfile, verificationSummary } from './worker.serializer.js';
const latest = user => Verification.findOne({ worker: user }).sort({ createdAt: -1, _id: -1 });
export function workerService(media) {
  async function findOwn(user) {
    const profile = await WorkerProfile.findOne({ user });
    if (!profile) throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Complete worker onboarding first');
    return profile;
  }
  async function check(profile, input, user) {
    if (input.services !== undefined) await activeServices(input.services);
    if (input.pricing !== undefined) await activeServices(input.pricing.map(p => p.service));
    const services = profile.services.map(String);
    if (profile.pricing.some(p => !services.includes(String(p.service)))) throw new ApiError(400, 'INVALID_PRICING_SERVICE', 'Pricing must reference a selected service');
    if (profile.portfolio.some(p => p.service && !services.includes(String(p.service)))) throw new ApiError(400, 'INVALID_PORTFOLIO_SERVICE', 'Existing portfolio items must reference selected services');
    if (input.profileImage) await media.owned(input.profileImage, user, 'PROFILE_IMAGE');
    if (profile.profileVisibility === 'PUBLIC') {
      if (!profile.professionTitle.trim() || profile.bio.trim().length < 20 || !services.length || !profile.serviceAreas.length) throw new ApiError(400, 'PROFILE_INCOMPLETE', 'Public profiles require a profession, a bio of at least 20 characters, services, and a service area');
      await activeServices(services);
    }
  }
  return {
    async own(user) { const p = await findOwn(user); return { profile: ownProfile(p, await latest(user)) }; },
    async create(user, input) {
      if (user.role !== 'WORKER') throw new ApiError(403, 'FORBIDDEN', 'Only workers can onboard');
      if (await WorkerProfile.exists({ user: user._id })) throw new ApiError(409, 'PROFILE_EXISTS', 'Professional profile already exists');
      const p = new WorkerProfile({ ...input, primaryLocation: input.primaryLocation || undefined, user: user._id });
      await check(p, input, user._id);
      try { await p.save(); } catch (error) { if (error.code === 11000) throw new ApiError(409, 'PROFILE_EXISTS', 'Professional profile already exists'); throw error; }
      return { profile: ownProfile(p, await latest(user._id)) };
    },
    async update(user, input) {
      const p = await findOwn(user);
      Object.assign(p, input, input.primaryLocation === null ? { primaryLocation: undefined } : {});
      await check(p, input, user);
      await p.save();
      return { profile: ownProfile(p, await latest(user)) };
    },
    async portfolio(user, action, input, itemId) {
      const p = await findOwn(user);
      if (input?.service) {
        if (!p.services.some(s => String(s) === input.service)) throw new ApiError(400, 'INVALID_PORTFOLIO_SERVICE', 'Select one of your profile services');
        await activeServices([input.service]);
      }
      if (action === 'add') {
        if (p.portfolio.length >= 30) throw new ApiError(400, 'PORTFOLIO_LIMIT', 'Maximum 30 portfolio items');
        await media.owned(input.media, user, 'PORTFOLIO');
        if (p.portfolio.some(item => String(item.media) === input.media)) throw new ApiError(409, 'PORTFOLIO_EXISTS', 'This media is already in the portfolio');
        p.portfolio.push(input);
      } else {
        const item = p.portfolio.id(itemId);
        if (!item) throw new ApiError(404, 'NOT_FOUND', 'Portfolio item not found');
        if (action === 'update') Object.assign(item, input);
        else item.deleteOne();
      }
      await p.save();
      return { portfolio: ownProfile(p, await latest(user)).portfolio };
    },
    async public(userId) {
      const user = await User.findOne({ _id: userId, role: 'WORKER', accountStatus: 'ACTIVE' }).select('firstName lastName');
      const p = await WorkerProfile.findOne({ user: userId, profileVisibility: 'PUBLIC' });
      if (!user || !p || !p.professionTitle || p.bio.length < 20 || !p.services.length || !p.serviceAreas.length) throw new ApiError(404, 'NOT_FOUND', 'Worker profile not found');
      let services;
      // A deactivated catalog entry must not remain publicly advertised.
      try { services = await activeServices(p.services.map(String)); }
      catch (error) { if (error.code === 'INVALID_SERVICES') throw new ApiError(404, 'NOT_FOUND', 'Worker profile not found'); throw error; }
      const verification = await latest(userId);
      const portfolio = await Promise.all(p.portfolio.map(async item => ({ id: item.id, title: item.title, description: item.description, service: item.service ? String(item.service) : null, media: await media.publicImage(item.media), createdAt: item.createdAt })));
      return { worker: { id: String(userId), name: { firstName: user.firstName, lastName: user.lastName }, profileImage: await media.publicImage(p.profileImage),
        professionTitle: p.professionTitle, bio: p.bio, yearsOfExperience: p.yearsOfExperience, skills: p.skills, services: services.map(serviceDTO),
        serviceAreas: p.serviceAreas.map(a => ({ name: a.name, region: a.region, country: a.country })), portfolio,
        pricing: ownProfile(p, verification).pricing, verificationSummary: verificationSummary(verification), averageRating: p.averageRating,
        reviewCount: p.reviewCount, completedJobsCount: p.completedJobsCount, availableNow: p.availableNow, profileVisibility: p.profileVisibility } };
    },
    async inspect(userId) {
      const user = await User.findOne({ _id: userId, role: 'WORKER' });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'Worker not found');
      const profile = await WorkerProfile.findOne({ user: userId });
      return { account: { id: user.id, firstName: user.firstName, lastName: user.lastName, accountStatus: user.accountStatus }, profile: profile ? ownProfile(profile, await latest(userId)) : null };
    },
  };
}
