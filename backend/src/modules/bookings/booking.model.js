import mongoose from 'mongoose';
const ref = (name, required = false) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: name,
  required,
});
const schema = new mongoose.Schema(
  {
    customer: ref('User', true),
    worker: ref('User', true),
    service: ref('Service', true),
    jobRequest: ref('JobRequest'),
    acceptedQuote: ref('Quote'),
    directProposal: ref('DirectProposal'),
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    serviceArea: { name: String, region: String, country: String },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number],
    },
    privateAddress: String,
    description: { type: String, required: true },
    agreedAmountBututs: {
      type: Number,
      required: true,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      validate: Number.isSafeInteger,
    },
    currency: { type: String, enum: ['GMD'], default: 'GMD' },
    payment: ref('Payment'),
    status: {
      type: String,
      enum: [
        'AWAITING_PAYMENT',
        'CONFIRMED',
        'IN_PROGRESS',
        'WORKER_MARKED_COMPLETED',
        'COMPLETED',
        'CANCELLED',
        'DISPUTED',
      ],
      default: 'AWAITING_PAYMENT',
    },
    reservationExpiresAt: Date,
    startedAt: Date,
    workerCompletedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    adminArchivedAt: Date,
    adminArchiveReason: { type: String, maxlength: 500 },
    completionNotes: String,
    completionEvidence: [ref('MediaAsset')],
    revision: { type: Number, default: 0 },
  },
  { timestamps: true, strict: 'throw' },
);
schema.index({ worker: 1, status: 1, scheduledStart: 1, scheduledEnd: 1 });
schema.index({ customer: 1, createdAt: -1, _id: -1 });
schema.index({ worker: 1, createdAt: -1, _id: -1 });
schema.index(
  { acceptedQuote: 1 },
  {
    unique: true,
    partialFilterExpression: { acceptedQuote: { $type: 'objectId' } },
  },
);
schema.index(
  { directProposal: 1 },
  {
    unique: true,
    partialFilterExpression: { directProposal: { $type: 'objectId' } },
  },
);
export const Booking = mongoose.model('Booking', schema);
