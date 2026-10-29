import mongoose from 'mongoose';
const id = (ref, required = false) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref,
  required,
});
const schema = new mongoose.Schema(
  {
    customer: id('User', true),
    worker: id('User', true),
    service: id('Service', true),
    description: { type: String, required: true, maxlength: 3000 },
    serviceArea: { name: String, region: String, country: String },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number],
    },
    privateAddress: String,
    pricingMode: { type: String, enum: ['REQUEST_QUOTE', 'LISTED_PRICE'] },
    budget: { minAmountBututs: Number, maxAmountBututs: Number },
    attachments: [id('MediaAsset')],
    listedPrice: { type: new mongoose.Schema({ type: String, amountBututs: Number }, { _id: false }), default: undefined },
    quoteRevision: { type: Number, default: 0 },
    quotes: [{
      revision: Number,
      amountBututs: { type: Number, min: 1, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
      note: { type: String, maxlength: 2000 },
      expiresAt: Date,
      createdAt: Date,
    }],
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    agreedAmountBututs: {
      type: Number,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      validate: Number.isSafeInteger,
      required: function () { return this.pricingMode !== 'REQUEST_QUOTE'; },
    },
    status: {
      type: String,
      enum: ['PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
    },
    expiresAt: { type: Date, required: true },
    booking: id('Booking'),
  },
  { timestamps: true, strict: 'throw' },
);
schema.index({ worker: 1, status: 1, expiresAt: 1 });
schema.index({ customer: 1, createdAt: -1, _id: -1 });
export const DirectProposal = mongoose.model('DirectProposal', schema);
