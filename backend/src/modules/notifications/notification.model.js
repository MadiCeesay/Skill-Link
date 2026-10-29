import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventKey: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 300 },
    relatedResourceType: { type: String, required: true },
    relatedResourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);
schema.index({ recipient: 1, eventKey: 1 }, { unique: true });
schema.index({ recipient: 1, readAt: 1, createdAt: -1, _id: -1 });
export const Notification = mongoose.model('Notification', schema);
