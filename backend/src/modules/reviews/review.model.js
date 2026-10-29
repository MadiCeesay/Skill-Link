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
    rating: {
      type: Number,
      min: 1,
      max: 5,
      validate: Number.isInteger,
      required: true,
    },
    comment: { type: String, maxlength: 2000, default: '' },
    moderationStatus: {
      type: String,
      enum: ['VISIBLE', 'HIDDEN'],
      default: 'VISIBLE',
    },
    moderationReason: String,
    moderatedBy: id('User'),
    moderatedAt: Date,
  },
  { timestamps: true, strict: 'throw' },
);
schema.index({ worker: 1, moderationStatus: 1, createdAt: -1, _id: -1 });
export const Review = mongoose.model('Review', schema);
