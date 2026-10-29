import mongoose from 'mongoose';
const mediaRef = { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' };
const schema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  identityDocument: { ...mediaRef, required: true }, skillCertificates: [mediaRef], workEvidence: [mediaRef],
  reference: { type: new mongoose.Schema({ name: String, relationship: String, contact: String }, { _id: false, strict: 'throw' }), default: undefined },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  submittedAt: { type: Date, default: Date.now }, reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adminNotes: { type: String, maxlength: 2000, default: '', select: false }, rejectionReason: { type: String, maxlength: 1000, default: '' },
  workEvidenceReviewed: { type: Boolean, default: false },
}, { timestamps: true, strict: 'throw' });
// Rejected attempts remain immutable history; only one pending/approved attempt per worker.
schema.index({ worker: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'APPROVED'] } }, name: 'one_active_verification_per_worker' });
schema.index({ status: 1, submittedAt: 1 });
export const Verification = mongoose.model('Verification', schema);
