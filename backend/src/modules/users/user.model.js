import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, ACCOUNT_STATUSES } from '../../constants/roles.js';
const schema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, maxlength: 254 },
  phoneNumber: { type: String, required: true, unique: true, match: /^\+[1-9]\d{7,14}$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true },
  profileImage: { type: String, default: null },
  accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'ACTIVE' },
  emailVerified: { type: Boolean, default: false },
  adminMetricsExcludedAt: Date,
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: true, strict: 'throw' });
// Only the virtual accepts plaintext; normal updates must never write passwordHash.
schema.virtual('password').set(function (value) { this.$locals.password = value; });
schema.pre('validate', async function () {
  if (this.$locals.password !== undefined) {
    const password = this.$locals.password;
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      this.invalidate('password', 'Password must have 8+ characters, upper/lowercase and a number, and at most 72 UTF-8 bytes');
      return;
    }
    this.passwordHash = await bcrypt.hash(password, 12);
    delete this.$locals.password;
  }
  if (this.isModified('passwordHash') && !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(this.passwordHash || '')) {
    this.invalidate('passwordHash', 'A valid password hash is required');
  }
});
schema.set('toJSON', { transform(_doc, ret) { delete ret.passwordHash; delete ret.tokenVersion; delete ret.__v; return ret; } });
export const User = mongoose.model('User', schema);
export function publicUser(user) {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email,
    phoneNumber: user.phoneNumber, role: user.role, profileImage: user.profileImage,
    accountStatus: user.accountStatus, emailVerified: user.emailVerified, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
