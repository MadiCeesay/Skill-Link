import mongoose from 'mongoose';
const id = (ref, required = false) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref,
  required,
});
const schema = new mongoose.Schema(
  {
    contextType: {
      type: String,
      enum: ['QUOTE', 'DIRECT_PROPOSAL', 'BOOKING'],
      required: true,
    },
    contextId: { type: mongoose.Schema.Types.ObjectId, required: true },
    customer: id('User', true),
    worker: id('User', true),
    participants: [id('User')],
    booking: id('Booking'),
  },
  { timestamps: true, strict: 'throw' },
);
schema.index({ contextType: 1, contextId: 1 }, { unique: true });
schema.index({ participants: 1, createdAt: -1, _id: -1 });
export const Conversation = mongoose.model('Conversation', schema);
const message = new mongoose.Schema(
  {
    conversation: id('Conversation', true),
    sender: id('User', true),
    type: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'VOICE', 'SYSTEM'],
      required: true,
    },
    text: { type: String, maxlength: 2000 },
    media: id('MediaAsset'),
    readBy: [id('User')],
    clientMessageId: { type: String, maxlength: 80, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);
message.index({ conversation: 1, createdAt: -1, _id: -1 });
message.index(
  { conversation: 1, sender: 1, clientMessageId: 1 },
  { unique: true },
);
export const Message = mongoose.model('Message', message);
