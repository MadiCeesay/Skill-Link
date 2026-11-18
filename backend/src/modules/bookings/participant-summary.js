import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { WorkerProfile } from '../workers/worker.model.js';
import { Service } from '../catalog/service.model.js';
import { MediaAsset } from '../media/media.model.js';
import { eligibleWorkerStages } from '../discovery/discovery.service.js';

// Call only after resource authorization. Recheck participation before enriching.
// Batch each lookup across the page; never load contact or identity-document fields.
export async function participantSummaries(rows, viewer, media) {
  const allowed = rows.filter(r => [String(r.customer), String(r.worker)].includes(String(viewer._id)));
  const others = [...new Set(allowed.map(r => String(r.customer) === String(viewer._id) ? String(r.worker) : String(r.customer)))];
  const serviceIds = [...new Set(allowed.map(r => r.service).filter(Boolean).map(String))];
  if (!allowed.length) return rows.map(() => ({}));
  const [people, services, profiles] = await Promise.all([
    User.find({ _id: mongoose.trusted({ $in: others }) }).select('firstName lastName profileImage role').lean(),
    Service.find({ _id: mongoose.trusted({ $in: serviceIds }) }).select('name').lean(),
    WorkerProfile.aggregate([{ $match: { user: { $in: others.map(id => new mongoose.Types.ObjectId(id)) } } }, ...eligibleWorkerStages(), { $project: { user: 1, profileImage: 1 } }]),
  ]);
  const publicPhotos = new Map(profiles.map(p => [String(p.user), p.profileImage]));
  const photoIds = people.map(p => p.role === 'WORKER' ? publicPhotos.get(String(p._id)) : p.profileImage).filter(id => mongoose.isValidObjectId(id));
  const photos = photoIds.length ? await MediaAsset.find({
    _id: mongoose.trusted({ $in: photoIds }), owner: mongoose.trusted({ $in: others }), purpose: 'PROFILE_IMAGE',
  }).select('+storageKey +resourceType +format +deliveryType') : [];
  const summaries = new Map(await Promise.all(people.map(async p => {
    const imageId = p.role === 'WORKER' ? publicPhotos.get(String(p._id)) : p.profileImage;
    const asset = photos.find(a => String(a._id) === String(imageId) && String(a.owner) === String(p._id));
    let profileImage = null;
    if (asset) {
      try { const { url, expiresAt } = await media.link(asset, 300); profileImage = { url, expiresAt }; }
      catch { /* Optional photos must not prevent access to the participant's work. */ }
    }
    return [String(p._id), { id: String(p._id), firstName: p.firstName, lastName: p.lastName, profileImage }];
  })));
  const catalog = new Map(services.map(s => [String(s._id), { id: String(s._id), name: s.name }]));
  return rows.map(r => {
    if (![String(r.customer), String(r.worker)].includes(String(viewer._id))) return {};
    const other = String(r.customer) === String(viewer._id) ? r.worker : r.customer;
    return { counterpart: summaries.get(String(other)) || null, serviceSummary: catalog.get(String(r.service)) || null };
  });
}
