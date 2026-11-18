import 'dotenv/config';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { registrationSchema } from '../src/modules/auth/auth.validator.js';
import { User } from '../src/modules/users/user.model.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../src/config/database.js';

export function adminInput(env) {
  const email = typeof env.ADMIN_EMAIL === 'string' ? env.ADMIN_EMAIL.trim().toLowerCase() : '';
  // Required by the existing User schema; a stable, non-contact placeholder.
  const suffix = (BigInt('0x' + createHash('sha256').update(email).digest('hex')) % 1000000000000n).toString().padStart(12, '0');
  const result = registrationSchema.safeParse({
    email, password: env.ADMIN_PASSWORD,
    firstName: env.ADMIN_FIRST_NAME, lastName: env.ADMIN_LAST_NAME,
    phoneNumber: env.ADMIN_PHONE_NUMBER || '+999' + suffix,
  });
  if (!result.success) throw new Error('Invalid ADMIN_* configuration; check names, email, phone and password policy.');
  return { ...result.data, explicitPhone: !!env.ADMIN_PHONE_NUMBER };
}

export async function seedAdmin(input) {
  const existing = await User.findOne({ email: input.email }).select('+passwordHash +tokenVersion');
  const user = existing || new User({ email: input.email, role: 'ADMIN', phoneNumber: input.phoneNumber });
  const passwordChanged = !existing || !await bcrypt.compare(input.password, user.passwordHash);
  const changed = !existing || passwordChanged || user.role !== 'ADMIN' || user.accountStatus !== 'ACTIVE' ||
    user.firstName !== input.firstName || user.lastName !== input.lastName ||
    (input.explicitPhone && user.phoneNumber !== input.phoneNumber);
  if (!changed) return 'unchanged';
  if (existing && (passwordChanged || user.role !== 'ADMIN' || user.accountStatus !== 'ACTIVE')) user.tokenVersion += 1;
  user.set({ firstName: input.firstName, lastName: input.lastName, role: 'ADMIN', accountStatus: 'ACTIVE' });
  if (input.explicitPhone) user.phoneNumber = input.phoneNumber;
  if (passwordChanged) user.password = input.password;
  await user.save();
  return existing ? 'updated' : 'created';
}

async function main() {
  try {
    const input = adminInput(process.env);
    if (!/^mongodb(\+srv)?:\/\//.test(process.env.MONGODB_URI || '')) throw new Error('MONGODB_URI is required.');
    await connectDatabase(process.env.MONGODB_URI);
    await ensureIndexes();
    console.info('Administrator ' + await seedAdmin(input) + '. Sign in using the configured ADMIN_EMAIL and ADMIN_PASSWORD.');
  } catch {
    // Never print Mongoose errors, input values, hashes or database credentials.
    console.error('Admin seed failed. Check MONGODB_URI connectivity, ADMIN_* configuration, password policy and phone uniqueness.');
    process.exitCode = 1;
  } finally { await disconnectDatabase(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
