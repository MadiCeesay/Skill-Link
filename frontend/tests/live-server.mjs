// Isolated browser-test backend. Never reads the user's database URI or starts in production.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { createApp } from '../../backend/src/app.js';
import { loadConfig } from '../../backend/src/config/env.js';
import {
  connectDatabase,
  ensureIndexes,
  disconnectDatabase,
} from '../../backend/src/config/database.js';
import { attachSocket } from '../../backend/src/realtime/socket.js';
import { User } from '../../backend/src/modules/users/user.model.js';
import { Category } from '../../backend/src/modules/catalog/category.model.js';
import { Service } from '../../backend/src/modules/catalog/service.model.js';
import { WorkerProfile } from '../../backend/src/modules/workers/worker.model.js';
import { Verification } from '../../backend/src/modules/verifications/verification.model.js';
import { MediaAsset } from '../../backend/src/modules/media/media.model.js';
import { Availability } from '../../backend/src/modules/availability/availability.model.js';
import { Booking } from '../../backend/src/modules/bookings/booking.model.js';
const require = createRequire(
    new URL('../../backend/package.json', import.meta.url),
  ),
  { MongoMemoryReplSet } = require('mongodb-memory-server'),
  express = require('express');
const cachedBinary = fileURLToPath(
  new URL(
    '../../backend/node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe',
    import.meta.url,
  ),
);
const mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }],
    ...(existsSync(cachedBinary)
      ? { binary: { systemBinary: cachedBinary } }
      : {}),
  }),
  key = randomUUID(),
  assets = new Map();
const sign = (id, expiry) =>
  createHmac('sha256', key)
    .update(id + ':' + expiry)
    .digest('hex');
const provider = {
  name: 'e2e-memory',
  async upload({ buffer, format, purpose }) {
    const storageKey = randomUUID();
    assets.set(storageKey, { buffer, format });
    return {
      storageKey,
      format,
      resourceType: purpose === 'VOICE_NOTE' ? 'video' : 'image',
      deliveryType: 'authenticated',
    };
  },
  async remove(asset) {
    assets.delete(asset.storageKey);
  },
  access(asset, expiresAt) {
    return (
      'http://127.0.0.1:5001/_test/media/' +
      asset.storageKey +
      '?expires=' +
      expiresAt +
      '&signature=' +
      sign(asset.storageKey, expiresAt)
    );
  },
};
const config = loadConfig({
  NODE_ENV: 'test',
  MONGODB_URI: mongo.getUri(),
  JWT_ACCESS_SECRET: 'e2e-access-only-not-production-123456789',
  JWT_REFRESH_SECRET: 'e2e-refresh-only-not-production-987654321',
  FRONTEND_ORIGIN: 'http://127.0.0.1:5174',
});
const app = createApp(config, {
    mediaProvider: provider,
    globalLimit: 20000,
    authLimit: 20000,
    marketWriteLimit: 20000,
    messageLimit: 20000,
    uploadLimit: 20000,
    paymentLimit: 20000,
  }),
  parent = express();
parent.get('/_test/media/:id', (req, res) => {
  const asset = assets.get(req.params.id),
    expires = Number(req.query.expires),
    provided = String(req.query.signature || ''),
    expected = sign(req.params.id, expires);
  if (
    !asset ||
    expires < Date.now() / 1000 ||
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return res.sendStatus(403);
  res
    .type(
      asset.format === 'wav'
        ? 'audio/wav'
        : asset.format === 'ogg'
          ? 'audio/ogg'
          : asset.format === 'webm'
            ? 'audio/webm'
            : 'image/' + asset.format,
    )
    .send(asset.buffer);
});
parent.post('/_test/start-now/:id', async (req, res) => {
  if (req.headers['x-test-fixture'] !== 'local-e2e-only')
    return res.sendStatus(403);
  await Booking.updateOne(
    { _id: req.params.id, status: 'CONFIRMED' },
    { $set: { scheduledStart: new Date(Date.now() - 60000) } },
  );
  res.json({ ok: true });
});
parent.use(app);
await connectDatabase(mongo.getUri());
await ensureIndexes();
const password = 'Test-password123',
  admin = await User.create({
    firstName: 'Test',
    lastName: 'Operator',
    email: 'ops@example.test',
    phoneNumber: '+2207000001',
    password,
    role: 'ADMIN',
  }),
  _customer = await User.create({
    firstName: 'Awa',
    lastName: 'Sowe',
    email: 'customer@example.test',
    phoneNumber: '+2207000002',
    password,
    role: 'CUSTOMER',
  }),
  worker = await User.create({
    firstName: 'Lamin',
    lastName: 'Jallow',
    email: 'professional@example.test',
    phoneNumber: '+2207000003',
    password,
    role: 'WORKER',
  });
let primaryService;
for (const [name, serviceName] of [
  ['Home & Utility', 'Electrician'],
  ['Repair & Maintenance', 'Appliance Repair'],
  ['Cleaning', 'Home Cleaning'],
  ['Construction & Property', 'Carpenter'],
  ['Personal & Lifestyle', 'Tailor'],
  ['Technology Services', 'Computer Repair'],
]) {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/-$/, '');
  const category = await Category.create({
    name,
    nameKey: name.toLowerCase(),
    slug,
  });
  const service = await Service.create({
    category: category._id,
    name: serviceName,
    nameKey: serviceName.toLowerCase(),
    slug: serviceName.toLowerCase().replaceAll(' ', '-'),
  });
  primaryService ??= service;
}
await WorkerProfile.create({
  user: worker._id,
  professionTitle: 'Electrician & solar installer',
  bio: 'Careful residential electrical work and solar installation throughout Brikama.',
  yearsOfExperience: 8,
  skills: ['Residential wiring', 'Solar installation'],
  services: [primaryService._id],
  serviceAreas: [{ name: 'Brikama', country: 'GM' }],
  profileVisibility: 'PUBLIC',
  primaryLocation: { type: 'Point', coordinates: [-16.65, 13.27] },
  pricing: [
    { service: primaryService._id, type: 'STARTING_FROM', amountBututs: 40000 },
  ],
  availableNow: true,
});
const asset = await MediaAsset.create({
  owner: worker._id,
  purpose: 'IDENTITY_DOCUMENT',
  provider: provider.name,
  storageKey: 'fixture-private-id',
  resourceType: 'image',
  format: 'png',
  deliveryType: 'authenticated',
  mimeType: 'image/png',
  bytes: 1,
});
await Verification.create({
  worker: worker._id,
  identityDocument: asset._id,
  status: 'APPROVED',
  reviewedAt: new Date(),
  reviewedBy: admin._id,
});
await Availability.create({
  worker: worker._id,
  weekly: Array.from({ length: 7 }, (_, day) => ({
    day,
    start: '08:00',
    end: '20:00',
  })),
});
const server = createServer(parent),
  io = attachSocket(server, app, config);
server.listen(5001, '127.0.0.1', () =>
  console.log('Isolated SkillLink browser-test API ready on 5001'),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise((resolve) => io.close(resolve));
  await disconnectDatabase();
  await mongo.stop();
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
