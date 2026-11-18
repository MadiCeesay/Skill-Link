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
      enum: ['TEXT', 'IMAGE', 'VOICE', 'SYSTEM', 'PRICE_OFFER'],
      required: true,
    },
    text: { type: String, maxlength: 2000 },
    media: id('MediaAsset'),
    priceOffer: id('ChatPriceOffer'),
    readBy: [id('User')],
    clientMessageId: { type: String, maxlength: 80, required: true },
    // Automatic transcript of a voice note, filled in the background after sending.
    transcript: {
      type: new mongoose.Schema({
        status: { type: String, enum: ['PENDING', 'DONE', 'FAILED', 'HIDDEN'], required: true },
        text: { type: String, maxlength: 4000 },
        languageCode: { type: String, maxlength: 12 },
        completedAt: Date,
      }, { _id: false, strict: 'throw' }),
      default: undefined,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);
message.index({ conversation: 1, createdAt: -1, _id: -1 });
message.index(
  { conversation: 1, sender: 1, clientMessageId: 1 },
  { unique: true },
);
export const Message = mongoose.model('Message', message);
const priceOffer = new mongoose.Schema({
  conversation: id('Conversation', true), proposal: id('DirectProposal', true),
  sender: id('User', true), recipient: id('User', true),
  amountBututs: { type: Number, required: true, min: 1, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  currency: { type: String, enum: ['GMD'], default: 'GMD' },
  status: { type: String, enum: ['OPEN', 'ACCEPTED', 'DECLINED', 'REPLACED'], default: 'OPEN' },
  respondedAt: Date,
}, { timestamps: true, strict: 'throw' });
priceOffer.index({ proposal: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN' }, name: 'one_open_chat_price_per_proposal' });
priceOffer.index({ conversation: 1, createdAt: -1 });
export const ChatPriceOffer = mongoose.model('ChatPriceOffer', priceOffer);
