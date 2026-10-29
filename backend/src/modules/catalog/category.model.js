import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  nameKey: { type: String, required: true, unique: true, select: false },
  slug: { type: String, required: true, unique: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, maxlength: 120 },
  description: { type: String, maxlength: 1000, default: '' },
  icon: { type: String, maxlength: 80, default: null },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, min: 0, default: 0 },
}, { timestamps: true, strict: 'throw' });
export const Category = mongoose.model('Category', schema);
