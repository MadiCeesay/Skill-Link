import mongoose from 'mongoose';
const ref = (model, required = false) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, required });
const point = new mongoose.Schema({ type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true, validate: v => v.length === 2 && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 } }, { _id: false });
const area = new mongoose.Schema({ name: { type: String, required: true }, region: String, country: { type: String, enum: ['GM'], default: 'GM' } }, { _id: false });
const budget = new mongoose.Schema({ type: { type: String, enum: ['FIXED', 'RANGE', 'OPEN_TO_QUOTES'], required: true }, amountBututs: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger }, minAmountBututs: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger }, maxAmountBututs: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger }, currency: { type: String, enum: ['GMD'], default: 'GMD' } }, { _id: false });
const agreement = new mongoose.Schema({
  customer: ref('User', true), worker: ref('User', true), service: ref('Service', true), jobRequest: ref('JobRequest', true), acceptedQuote: ref('Quote', true),
  agreedAmountBututs: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }, currency: { type: String, enum: ['GMD'], default: 'GMD' },
  estimatedDurationMinutes: Number, proposedSchedule: { date: String, note: String }, message: String,
  jobTitle: String, jobDescription: String, serviceArea: area, acceptedAt: { type: Date, required: true },
}, { _id: false, strict: 'throw' });
const schema = new mongoose.Schema({
  customer: ref('User', true), service: ref('Service', true), title: { type: String, required: true, maxlength: 120 }, description: { type: String, required: true, maxlength: 3000 },
  serviceArea: { type: area, required: true }, areaKey: { type: String, required: true }, regionKey: String,
  location: { type: point, default: undefined }, privateAddress: { type: String, maxlength: 500, default: '' },
  preferredDate: String, preferredTimeNote: { type: String, maxlength: 200, default: '' },
  budget: { type: budget, default: () => ({ type: 'OPEN_TO_QUOTES' }) }, attachments: [ref('MediaAsset')],
  status: { type: String, enum: ['OPEN', 'QUOTE_ACCEPTED', 'CANCELLED', 'EXPIRED'], default: 'OPEN' },
  quoteCount: { type: Number, default: 0 }, acceptedQuote: ref('Quote'), agreement: { type: agreement, default: undefined },
  expiresAt: { type: Date, required: true }, revision: { type: Number, default: 0 },
}, { timestamps: true, strict: 'throw' });
schema.index({ customer: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, service: 1, areaKey: 1, expiresAt: 1 });
schema.index({ status: 1, expiresAt: 1 });
schema.index({ location: '2dsphere' });
export const JobRequest = mongoose.model('JobRequest', schema);
