import mongoose from 'mongoose';
export async function connectDatabase(uri) {
  mongoose.set('sanitizeFilter', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
}
export async function ensureIndexes() {
  // These unique indexes are security invariants, not optional optimizations.
  await Promise.all(Object.values(mongoose.models).map(model => model.createIndexes()));
}
export async function disconnectDatabase() { await mongoose.disconnect(); }
