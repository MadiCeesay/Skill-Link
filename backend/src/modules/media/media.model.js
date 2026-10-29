import mongoose from 'mongoose';
export const MEDIA_PURPOSES = ['PROFILE_IMAGE', 'PORTFOLIO', 'IDENTITY_DOCUMENT', 'SKILL_CERTIFICATE', 'WORK_EVIDENCE', 'JOB_ATTACHMENT', 'CHAT_IMAGE', 'VOICE_NOTE', 'COMPLETION_EVIDENCE', 'DISPUTE_EVIDENCE'];
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: MEDIA_PURPOSES, required: true },
  mimeType: { type: String, required: true },
  bytes: { type: Number, required: true, min: 1 },
  provider: { type: String, required: true },
  storageKey: { type: String, required: true, select: false },
  resourceType: { type: String, required: true, select: false },
  format: { type: String, required: true, select: false },
  deliveryType: { type: String, enum: ['authenticated'], required: true, select: false },
}, { timestamps: true, strict: 'throw' });
export const MediaAsset = mongoose.model('MediaAsset', schema);
export const mediaDTO = m => ({ id: m.id, purpose: m.purpose, mimeType: m.mimeType, bytes: m.bytes, createdAt: m.createdAt });
