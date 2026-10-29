import mongoose from 'mongoose';
const id = (ref, required = false) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref,
  required,
});
const money = {
  type: Number,
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
  validate: Number.isSafeInteger,
  required: true,
};
const schema = new mongoose.Schema(
  {
    booking: { ...id('Booking', true), unique: true },
    customer: id('User', true),
    worker: id('User', true),
    amountBututs: money,
    platformFeeBututs: money,
    workerAmountBututs: money,
    commissionBasisPoints: { type: Number, min: 0, max: 10000, required: true },
    currency: { type: String, enum: ['GMD'], default: 'GMD' },
    provider: { type: String, enum: ['mock'], required: true },
    providerReference: String,
    status: {
      type: String,
      enum: ['PENDING', 'FAILED', 'HELD', 'RELEASED', 'REFUNDED', 'DISPUTED'],
      required: true,
    },
    paidAt: Date,
    heldAt: Date,
    releasedAt: Date,
    refundedAt: Date,
    disputedAt: Date,
  },
  { timestamps: true, strict: 'throw' },
);
schema.index({ worker: 1, status: 1 });
schema.index({ status: 1, createdAt: -1 });
export const Payment = mongoose.model('Payment', schema);
const attempt = new mongoose.Schema(
  {
    customer: id('User', true),
    booking: id('Booking', true),
    payment: id('Payment', true),
    key: { type: String, required: true },
    outcome: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'PENDING'],
      required: true,
    },
    resultStatus: { type: String, required: true },
    providerReference: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);
attempt.index({ customer: 1, key: 1 }, { unique: true });
export const PaymentAttempt = mongoose.model('PaymentAttempt', attempt);
const ledger = new mongoose.Schema(
  {
    payment: id('Payment', true),
    booking: id('Booking', true),
    customer: id('User', true),
    worker: id('User', true),
    type: {
      type: String,
      enum: [
        'CUSTOMER_PAYMENT',
        'PLATFORM_FEE',
        'WORKER_PENDING_EARNING',
        'WORKER_RELEASE',
        'REFUND',
      ],
      required: true,
    },
    amountBututs: money,
    currency: { type: String, enum: ['GMD'], default: 'GMD' },
    simulated: { type: Boolean, default: true, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);
ledger.index({ payment: 1, type: 1 }, { unique: true });
ledger.index({ worker: 1, type: 1, createdAt: -1 });
export const FinancialLedgerEntry = mongoose.model(
  'FinancialLedgerEntry',
  ledger,
);
