import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from '../helpers/mongo-memory.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { adminInput, seedAdmin } from '../../scripts/seed-admin.mjs';
let mongo;
const env = { ADMIN_EMAIL: ' ADMIN@example.test ', ADMIN_PASSWORD: 'Strong-password123', ADMIN_FIRST_NAME: 'Demo', ADMIN_LAST_NAME: 'Operator' };
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await connectDatabase(mongo.getUri()); await ensureIndexes(); });
beforeEach(async () => { await User.deleteMany({}); });
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });
it('creates a login-compatible admin from the four requested variables and is idempotent', async () => {
  const input = adminInput(env);
  expect(await seedAdmin(input)).toBe('created');
  const first = await User.findOne().select('+passwordHash +tokenVersion');
  expect(first).toMatchObject({ firstName: 'Demo', lastName: 'Operator', email: 'admin@example.test', role: 'ADMIN', accountStatus: 'ACTIVE' });
  expect(await bcrypt.compare(env.ADMIN_PASSWORD, first.passwordHash)).toBe(true);
  expect(await seedAdmin(input)).toBe('unchanged');
  const second = await User.findOne().select('+passwordHash +tokenVersion');
  expect(second.passwordHash).toBe(first.passwordHash);
  expect(second.tokenVersion).toBe(first.tokenVersion);
  expect(await User.countDocuments()).toBe(1);
});
it('updates an existing account, preserves its phone, and invalidates old tokens when changing credentials or role', async () => {
  const { explicitPhone: _flag, ...fields } = adminInput({ ...env, ADMIN_PHONE_NUMBER: '+2207000001' });
  const user = await User.create({ ...fields, role: 'CUSTOMER' });
  expect(await seedAdmin(adminInput({ ...env, ADMIN_PASSWORD: 'Different-password456', ADMIN_FIRST_NAME: 'Updated' }))).toBe('updated');
  const updated = await User.findById(user._id).select('+passwordHash +tokenVersion');
  expect(updated.role).toBe('ADMIN');
  expect(updated.firstName).toBe('Updated');
  expect(updated.phoneNumber).toBe('+2207000001');
  expect(updated.tokenVersion).toBe(1);
  expect(await bcrypt.compare('Different-password456', updated.passwordHash)).toBe(true);
  expect(await User.countDocuments()).toBe(1);
});
it('validates missing configuration and weak passwords without echoing values', () => {
  for (const key of Object.keys(env)) expect(() => adminInput({ ...env, [key]: '' })).toThrow('Invalid ADMIN_*');
  expect(() => adminInput({ ...env, ADMIN_PASSWORD: 'weak' })).toThrow('Invalid ADMIN_*');
});
it('rejects duplicate phones without overwriting another user', async () => {
  await seedAdmin(adminInput({ ...env, ADMIN_PHONE_NUMBER: '+2207000001' }));
  await expect(seedAdmin(adminInput({ ...env, ADMIN_EMAIL: 'other@example.test', ADMIN_PHONE_NUMBER: '+2207000001' }))).rejects.toMatchObject({ code: 11000 });
  expect(await User.countDocuments()).toBe(1);
});
