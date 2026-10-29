import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  nameKey: { type: String, required: true, select: false },
  slug: { type: String, required: true, unique: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, maxlength: 120 },
  description: { type: String, maxlength: 1000, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, strict: 'throw' });
schema.index({ category: 1, nameKey: 1 }, { unique: true });
export const Service = mongoose.model('Service', schema);
