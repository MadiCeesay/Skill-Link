import mongoose from 'mongoose';
const id = (ref, required = false) => ({ type: mongoose.Schema.Types.ObjectId, ref, required });
const pricing = new mongoose.Schema({
  service: id('Service', true),
  type: { type: String, enum: ['FIXED', 'HOURLY', 'STARTING_FROM', 'QUOTE_REQUIRED'], required: true },
  amountBututs: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  currency: { type: String, enum: ['GMD'], default: 'GMD' },
}, { _id: false, strict: 'throw' });
const area = new mongoose.Schema({ name: { type: String, required: true, maxlength: 100 }, region: { type: String, maxlength: 100 }, country: { type: String, enum: ['GM'], default: 'GM' } }, { _id: false, strict: 'throw' });
const point = new mongoose.Schema({ type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true, validate: v => v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 } }, { _id: false, strict: 'throw' });
const portfolio = new mongoose.Schema({
  media: id('MediaAsset', true), title: { type: String, required: true, maxlength: 120 },
  description: { type: String, maxlength: 1000, default: '' }, service: id('Service'),
}, { timestamps: true, strict: 'throw' });
const schema = new mongoose.Schema({
  user: { ...id('User', true), unique: true },
  professionTitle: { type: String, maxlength: 120, default: '' },
  bio: { type: String, maxlength: 2000, default: '' },
  yearsOfExperience: { type: Number, min: 0, max: 80, default: 0, validate: Number.isInteger },
  skills: [{ type: String, maxlength: 100 }],
  services: [id('Service')], serviceAreas: [area], primaryLocation: { type: point, default: undefined },
  serviceRadiusKm: { type: Number, min: 1, max: 2000, default: 25 },
  profileImage: id('MediaAsset'), portfolio: [portfolio], pricing: [pricing],
  averageRating: { type: Number, default: 0 }, reviewCount: { type: Number, default: 0 }, completedJobsCount: { type: Number, default: 0 },
  availableNow: { type: Boolean, default: false }, profileVisibility: { type: String, enum: ['DRAFT', 'PUBLIC'], default: 'DRAFT' },
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true });
schema.index({ primaryLocation: '2dsphere' });
schema.index({ profileVisibility: 1, services: 1 });
export const WorkerProfile = mongoose.model('WorkerProfile', schema);
