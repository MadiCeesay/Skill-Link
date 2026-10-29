// Trusted operator bootstrap only. Marketplace records must be created through the API/UI.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { loadConfig } from '../src/config/env.js';
import { User } from '../src/modules/users/user.model.js';
const config = loadConfig();
if (config.NODE_ENV !== 'development') throw Error('Local integration setup requires development mode');
const folder = new URL('../.local-integration/', import.meta.url);
await mkdir(folder, { recursive: true });
const file = new URL('accounts.json', folder);
let accounts;
try { accounts = JSON.parse(await readFile(file, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const suffix = Date.now().toString(36);
  const account = (role) => ({ email: `integration-${role}-${suffix}@example.test`, password: 'Demo1-' + randomBytes(20).toString('base64url'), phoneNumber: '+220' + String(Math.floor(Math.random() * 10000000)).padStart(7, '0') });
  accounts = { admin: account('admin'), customer: account('customer'), worker: account('worker') };
  await writeFile(file, JSON.stringify(accounts, null, 2), { flag: 'wx', mode: 0o600 });
}
try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  if (!await User.exists({ email: accounts.admin.email })) {
    await User.create({ firstName: 'Integration', lastName: 'Operator', role: 'ADMIN', ...accounts.admin });
    console.log('Dedicated development operator created using the User model password validation/hash.');
  } else console.log('Dedicated development operator already exists; no account changed.');
  console.log('Local account details: backend/.local-integration/accounts.json (ignored; never publish).');
} finally { await mongoose.disconnect(); }
