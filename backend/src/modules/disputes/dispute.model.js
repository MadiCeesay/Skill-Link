import mongoose from 'mongoose';
const id = (ref, required = false) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref,
  required,
});
const schema = new mongoose.Schema(
  {
    booking: { ...id('Booking', true), unique: true },
    customer: id('User', true),
    worker: id('User', true),
    reason: { type: String, required: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 3000 },
    evidence: [id('MediaAsset')],
    status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' },
    adminDecision: {
      type: String,
      enum: ['RELEASE_TO_WORKER', 'REFUND_CUSTOMER'],
    },
    decisionReason: { type: String, maxlength: 2000 },
    reviewedBy: id('User'),
    reviewedAt: Date,
  },
  { timestamps: true, strict: 'throw' },
);
schema.index({ status: 1, createdAt: -1, _id: -1 });
schema.index({ customer: 1, createdAt: -1 });
schema.index({ worker: 1, createdAt: -1 });
export const Dispute = mongoose.model('Dispute', schema);
