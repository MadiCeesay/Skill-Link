import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  jobRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRequest', required: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposedAmountBututs: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger }, currency: { type: String, enum: ['GMD'], default: 'GMD' },
  message: { type: String, maxlength: 1500, default: '' }, estimatedDurationMinutes: { type: Number, min: 15, max: 43200 },
  proposedSchedule: { type: new mongoose.Schema({ date: String, note: { type: String, maxlength: 300 } }, { _id: false }), default: undefined },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'], default: 'PENDING' }, expiresAt: { type: Date, required: true },
}, { timestamps: true, strict: 'throw' });
schema.index({ jobRequest: 1, worker: 1 }, { unique: true });
schema.index({ jobRequest: 1 }, { unique: true, partialFilterExpression: { status: 'ACCEPTED' }, name: 'one_accepted_quote_per_job' });
schema.index({ worker: 1, createdAt: -1, _id: -1 });
schema.index({ jobRequest: 1, status: 1, expiresAt: 1 });
export const Quote = mongoose.model('Quote', schema);
