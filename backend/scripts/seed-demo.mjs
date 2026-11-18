import 'dotenv/config';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir, open, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import { CloudinaryMediaProvider } from '../src/providers/media/cloudinary.provider.js';
import { mediaService } from '../src/modules/media/media.service.js';
import { User } from '../src/modules/users/user.model.js';
import { WorkerProfile } from '../src/modules/workers/worker.model.js';
import { Category } from '../src/modules/catalog/category.model.js';
import { Service } from '../src/modules/catalog/service.model.js';
import { Availability, WorkerScheduleLock } from '../src/modules/availability/availability.model.js';
import { Verification } from '../src/modules/verifications/verification.model.js';
import { MediaAsset } from '../src/modules/media/media.model.js';
import { Booking } from '../src/modules/bookings/booking.model.js';
import { DirectProposal } from '../src/modules/bookings/proposal.model.js';
import { JobRequest } from '../src/modules/jobRequests/job.model.js';
import { Payment, PaymentAttempt, FinancialLedgerEntry } from '../src/modules/payments/payment.model.js';
import { breakdown, ledger } from '../src/modules/payments/payment.service.js';
import { Dispute } from '../src/modules/disputes/dispute.model.js';
import { Conversation, Message } from '../src/modules/conversations/conversation.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { recordAudit } from '../src/modules/admin/audit.model.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = text => createHash('sha256').update(text).digest('hex');
export const demoId = key => new mongoose.Types.ObjectId(hash('skilllink-demo-v1:' + key).slice(0, 24));
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
const area = name => ({ name, country: 'GM' });
const descriptions = {
  Electrician: 'Install and repair wiring, lights, sockets and electrical fittings.',
  Carpentry: 'Build and repair wooden doors, furniture, cupboards and roofs.',
  Plumbing: 'Fix leaks and install taps, toilets, pipes and water tanks.',
  Painting: 'Prepare and paint walls, ceilings, doors and exterior surfaces.',
  Masonry: 'Build and repair block walls, concrete floors and tiled surfaces.',
  'Appliance repair': 'Find faults and repair fridges, cookers, fans and washing machines.',
  'House cleaning': 'Clean homes, kitchens and bathrooms, including after building work.',
  Tailoring: 'Sew, alter and repair everyday clothing, uniforms and occasion wear.',
};
// Fictional demonstration people, never imported from or merged with real accounts.
export const demoWorkers = [
  ['lamin-jallow', 'Lamin', 'Jallow', 'Serrekunda', 'Electrician', 'Home wiring and lighting repairs', ['Wiring', 'Socket replacement', 'Lighting'], 750],
  ['ebou-ceesay', 'Ebou', 'Ceesay', 'Brikama', 'Carpentry', 'Doors, cupboards and furniture repairs', ['Door fitting', 'Furniture repairs', 'Cabinet making'], 1200],
  ['ousman-darboe', 'Ousman', 'Darboe', 'Bakau', 'Plumbing', 'Reliable tap, pipe and toilet repairs', ['Leak repairs', 'Water tanks', 'Bathroom fittings'], 600],
  ['fatou-sowe', 'Fatou', 'Sowe', 'Banjul', 'Painting', 'Neat painting for homes and shops', ['Interior painting', 'Wall preparation', 'Exterior painting'], 1500],
  ['modou-bah', 'Modou', 'Bah', 'Lamin', 'Masonry', 'Block work, floor repairs and tiling', ['Block laying', 'Concrete repairs', 'Tiling'], 1800],
  ['alieu-touray', 'Alieu', 'Touray', 'Brusubi', 'Appliance repair', 'Fridge, fan and cooker repairs', ['Fault diagnosis', 'Fridge repairs', 'Fan repairs'], 850],
  ['binta-sanneh', 'Binta', 'Sanneh', 'Farato', 'House cleaning', 'Careful cleaning for busy households', ['Deep cleaning', 'Kitchen cleaning', 'Move-in cleaning'], 1000],
  ['mariama-joof', 'Mariama', 'Joof', 'Yundum', 'Tailoring', 'Clothes made and altered to fit', ['Dressmaking', 'School uniforms', 'Alterations'], 700],
  ['bakary-sanyang', 'Bakary', 'Sanyang', 'Brikama', 'Carpentry', 'Wooden doors and custom shelves', ['Shelving', 'Door repairs', 'Joinery'], 950],
  ['isatou-jatta', 'Isatou', 'Jatta', 'Serrekunda', 'Tailoring', 'Everyday clothes and simple alterations', ['Hemming', 'Repairs', 'Uniforms'], 450],
];
const customers = [['amadou-gaye', 'Amadou', 'Gaye'], ['haddy-camara', 'Haddy', 'Camara'], ['sainabou-njie', 'Sainabou', 'Njie']];
export const demoStages = ['AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'WORKER_MARKED_COMPLETED', 'COMPLETED', 'CANCELLED', 'DISPUTED'];
async function json(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path + '.tmp', JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(path + '.tmp', path);
}
async function existingJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function createOnce(Model, key, values, session = null) {
  const _id = demoId(key);
  const existing = await Model.findById(_id).session(session);
  if (existing) return existing;
  return (await Model.create([{ _id, ...values }], { session }))[0];
}

// Only the four exact historical generated accounts and exact generated emails qualify.
// A name beginning with Integration alone is deliberately insufficient for deletion.
const legacyIds = ['6add8614c533247bf7db5ee6', '6add87261c357b3bb8d632b2', '6add872c1c357b3bb8d632d6', '6adfef12aa0ddab68ab1d26a', '6adfef18aa0ddab68ab1d289'];
export async function cleanLegacy(actor, localDir) {
  const old = await User.find({ $or: [
    { _id: mongoose.trusted({ $in: legacyIds }) },
    { email: mongoose.trusted({ $regex: /^(integration|manual)-(customer|worker)-[a-z0-9]+@example\.test$/ }) },
  ] }).select('+tokenVersion');
  if (!old.length) return { accounts: 0, messages: 0, offers: 0 };
  const ids = old.map(u => u._id), inIds = mongoose.trusted({ $in: ids });
  const bookings = await Booking.find({ $or: [{ customer: inIds }, { worker: inIds }] });
  const offers = await DirectProposal.find({ customer: inIds, worker: inIds });
  // Mixed real/demo conversations and their messages remain intact.
  const conversations = await Conversation.find({ customer: inIds, worker: inIds });
  const conversationIds = mongoose.trusted({ $in: conversations.map(c => c._id) });
  const messages = await Message.find({ conversation: conversationIds });
  const jobs = await JobRequest.find({ customer: inIds });
  const backup = join(localDir, 'legacy-cleanup-backup.json');
  if (!await existingJson(backup)) await json(backup, { users: old.map(u => ({ id: u.id, accountStatus: u.accountStatus })), bookings, offers, conversations, messages, jobs });
  await mongoose.connection.transaction(async session => {
    for (const user of old) {
      if (String(user._id) === String(actor)) throw new Error('Cannot archive the replacement administrator.');
      if (user.accountStatus !== 'DISABLED' || !user.adminMetricsExcludedAt) {
        await User.updateOne({ _id: user._id }, { $set: { accountStatus: 'DISABLED', adminMetricsExcludedAt: new Date() }, $inc: { tokenVersion: 1 } }, { session });
        await Session.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session });
        await WorkerProfile.updateOne({ user: user._id }, { $set: { profileVisibility: 'DRAFT' } }, { session });
        await recordAudit(actor, 'DEMO_ACCOUNT_ARCHIVED', 'User', user._id, ['accountStatus', 'adminMetricsExcludedAt'], session, 'Retired generated Integration test account.');
      }
    }
    for (const b of bookings) if (!b.adminArchivedAt) {
      await Booking.updateOne({ _id: b._id }, { $set: { adminArchivedAt: new Date(), adminArchiveReason: 'Retired Integration test booking; financial records retained.' } }, { session });
      await recordAudit(actor, 'BOOKING_ARCHIVED', 'Booking', b._id, ['adminArchivedAt', 'adminArchiveReason'], session, 'Demo cleanup; no payment or ledger changes.');
    }
    await JobRequest.updateMany({ customer: inIds, status: 'OPEN' }, { $set: { status: 'CANCELLED' } }, { session });
    // Accepted offers remain as booking provenance; only unbooked, pure-test junk is removed.
    await DirectProposal.deleteMany({ _id: mongoose.trusted({ $in: offers.filter(p => !p.booking && p.status !== 'ACCEPTED').map(p => p._id) }) }, { session });
    await Message.deleteMany({ conversation: conversationIds }, { session });
    await Conversation.deleteMany({ _id: conversationIds }, { session });
  });
  return { accounts: old.length, messages: messages.length, offers: offers.filter(p => !p.booking && p.status !== 'ACCEPTED').length };
}

// Explicit, narrow repair of known legacy records, not inference from a worker's current trade.
export async function repairCarpentry(actor, localDir) {
  const carpenter = '6adea1f1c3fcd71ca2c07e82';
  const electrical = await Service.findOne({ name: 'Electrician' });
  const carpentry = await Service.findOne({ name: 'Carpentry' });
  if (!electrical || !carpentry) return 0;
  const offers = await DirectProposal.find({ _id: mongoose.trusted({ $in: ['6adfc5a16ca734c3bf3db8f2', '6adfc8276ca734c3bf3dbba6', '6adfc9e26ca734c3bf3dbc8b'] }), worker: carpenter, service: electrical._id });
  if (!offers.length) return 0;
  const bookings = await Booking.find({ directProposal: mongoose.trusted({ $in: offers.map(p => p._id) }), worker: carpenter, service: electrical._id });
  const backup = join(localDir, 'carpentry-label-backup.json');
  if (!await existingJson(backup)) await json(backup, { offers, bookings });
  await mongoose.connection.transaction(async session => {
    for (const p of offers) await DirectProposal.updateOne({ _id: p._id, service: electrical._id }, { $set: { service: carpentry._id } }, { session });
    for (const b of bookings) {
      await Booking.updateOne({ _id: b._id, service: electrical._id }, { $set: { service: carpentry._id } }, { session });
      await recordAudit(actor, 'BOOKING_SERVICE_LABEL_CORRECTED', 'Booking', b._id, ['service'], session, 'Corrected legacy carpenter offer labelled Electrician; amounts and financial history unchanged.');
    }
  });
  return offers.length;
}

export async function seedDemo({ config, media, localDir, assetsDir = join(root, 'seed-assets'), cleanup = true, now = new Date() }) {
  await mkdir(localDir, { recursive: true });
  // Write credentials BEFORE database work so an interrupted first run is recoverable.
  const loginPath = join(localDir, 'demo-logins.json');
  const fingerprint = hash(mongoose.connection.host + ':' + mongoose.connection.port + '/' + mongoose.connection.name);
  let manifest = await existingJson(loginPath);
  if (manifest && (manifest.version !== 1 || manifest.database !== fingerprint)) throw new Error('Demo login file belongs to another database. Use a separate local directory.');
  if (!manifest) manifest = { version: 1, database: fingerprint, accounts: [], assets: {} };
  const people = [...demoWorkers.map(w => [w[0], w[1], w[2], 'WORKER']), ...customers.map(c => [...c, 'CUSTOMER']), ['admin', 'Awa', 'Demo Admin', 'ADMIN']];
  for (const [key, firstName, lastName, role] of people) if (!manifest.accounts.some(a => a.key === key)) manifest.accounts.push({ key, firstName, lastName, role, id: String(demoId('user:' + key)), email: key + '@demo.skilllink.test', password: 'Demo9!' + randomBytes(18).toString('base64url') });
  await json(loginPath, manifest);
  const users = new Map();
  for (const [index, account] of manifest.accounts.entries()) {
    const existing = await User.findById(account.id);
    if (existing && (existing.email !== account.email || existing.role !== account.role)) throw new Error('Demo identity collision; existing account was not changed.');
    const phoneNumber = '+999' + (81000000000 + index);
    // Never claim a pre-existing address/phone, nor reset passwords or suspended accounts on rerun.
    if (!existing && await User.exists({ $or: [{ email: account.email }, { phoneNumber }] })) throw new Error('Demo contact collision; existing account was not changed.');
    const user = existing || await User.create({ _id: account.id, firstName: account.firstName, lastName: account.lastName, role: account.role, email: account.email, phoneNumber, password: account.password });
    users.set(account.key, user);
  }
  const admin = users.get('admin');
  if (admin.accountStatus !== 'ACTIVE') throw new Error('Replacement demo administrator is inactive.');
  const services = new Map();
  for (const [name, description] of Object.entries(descriptions)) {
    const categoryName = name === 'Tailoring' ? 'Clothing & Tailoring' : name === 'House cleaning' ? 'Cleaning' : 'Home & Utility';
    let category = await Category.findOne({ nameKey: categoryName.toLowerCase() });
    if (!category) category = await Category.create({ name: categoryName, nameKey: categoryName.toLowerCase(), slug: slug(categoryName) });
    let service = await Service.findOne({ nameKey: name.toLowerCase(), category: category._id });
    if (!service) service = await Service.create({ name, nameKey: name.toLowerCase(), slug: slug(name), category: category._id, description });
    if (!service.isActive || !category.isActive) throw new Error('A required demo service is disabled; enable it explicitly before seeding.');
    if (service.description !== description) {
      await mongoose.connection.transaction(async session => {
        await Service.updateOne({ _id: service._id }, { $set: { description } }, { session });
        await recordAudit(admin._id, 'SERVICE_DESCRIPTION_UPDATED', 'Service', service._id, ['description'], session, 'Added plain-language demo catalog description.');
      });
    }
    services.set(name, service);
  }
  async function upload(key, owner, purpose, buffer, mimetype) {
    if (manifest.assets[key] && await MediaAsset.exists({ _id: manifest.assets[key], owner: owner._id, purpose })) return manifest.assets[key];
    const asset = await media.upload(owner, purpose, { buffer, mimetype, size: buffer.length });
    manifest.assets[key] = asset.id;
    await json(loginPath, manifest);
    return asset.id;
  }
  let photos = 0;
  for (const [index, w] of demoWorkers.entries()) {
    const [key, , , town, serviceName, professionTitle, skills, gmd] = w;
    const user = users.get(key), service = services.get(serviceName);
    const profile = await createOnce(WorkerProfile, 'profile:' + key, { user: user._id, professionTitle, bio: `I help households in ${town} with ${skills.join(', ').toLowerCase()}. I explain the work and agree the price before starting.`, yearsOfExperience: 3 + index, skills, services: [service._id], serviceAreas: [area(town)], pricing: [{ service: service._id, type: 'FIXED', amountBututs: gmd * 100 }], profileVisibility: 'PUBLIC' });
    await createOnce(Availability, 'availability:' + key, { worker: user._id, timezone: 'Africa/Banjul', weekly: [1, 2, 3, 4, 5, 6].map(day => ({ day, start: '08:00', end: '18:00' })) });
    await WorkerScheduleLock.updateOne({ _id: user._id }, { $setOnInsert: { revision: 0 } }, { upsert: true });
    const dir = join(assetsDir, key);
    await mkdir(dir, { recursive: true });
    let files = [];
    try { files = await readdir(dir); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const photo = files.find(f => /^profile\.(jpg|jpeg|png)$/i.test(f));
    if (photo && !profile.profileImage) {
      const buffer = await readFile(join(dir, photo));
      profile.profileImage = await upload(key + ':profile:' + hash(buffer), user, 'PROFILE_IMAGE', buffer, /png$/i.test(photo) ? 'image/png' : 'image/jpeg');
      photos++;
    }
    for (const file of files.filter(f => /^portfolio-[a-z0-9-]+\.(jpg|jpeg|png)$/i.test(f)).sort()) {
      const buffer = await readFile(join(dir, file));
      const asset = await upload(key + ':portfolio:' + hash(buffer), user, 'PORTFOLIO', buffer, /png$/i.test(file) ? 'image/png' : 'image/jpeg');
      if (!profile.portfolio.some(p => String(p.media) === asset)) profile.portfolio.push({ media: asset, service: service._id, title: professionTitle, description: 'Sample work supplied for this demo profile.' });
    }
    if (profile.isModified()) await profile.save();
    if (!await Verification.exists({ worker: user._id })) {
      // Clearly synthetic demo evidence, never an identity document belonging to a real person.
      const buffer = await sharp(Buffer.from('<svg width="700" height="180"><rect width="100%" height="100%" fill="white"/><text x="25" y="65" font-size="28">SKILLLINK DEMO ONLY</text><text x="25" y="115" font-size="22">Synthetic test evidence - not proof of identity</text></svg>')).png().toBuffer();
      const identityDocument = await upload(key + ':demo-evidence', user, 'IDENTITY_DOCUMENT', buffer, 'image/png');
      const pending = index === 9;
      await createOnce(Verification, 'verification:' + key, { worker: user._id, identityDocument, status: pending ? 'PENDING' : 'APPROVED', submittedAt: now, ...(pending ? {} : { reviewedAt: now, reviewedBy: admin._id }), adminNotes: 'Fictional demo account. Synthetic test evidence; no real identity verification performed.' });
    }
  }
  const jobs = [
    ['Repair a leaking kitchen tap', 'The kitchen tap drips after it is closed. Please check the tap and its connections.', 2, 'Bakau'],
    ['Fit a wooden bedroom door', 'Fit and align a wooden bedroom door and attach a new handle.', 1, 'Brikama'],
    ['Paint two bedroom walls', 'Prepare and paint two bedroom walls. We will agree on paint and materials before work starts.', 3, 'Banjul'],
  ];
  for (const [index, [title, description, workerIndex, town]] of jobs.entries()) await createOnce(JobRequest, 'job:' + index, { customer: users.get(customers[index][0])._id, service: services.get(demoWorkers[workerIndex][4])._id, title, description, serviceArea: area(town), areaKey: town.toLowerCase(), expiresAt: new Date(+now + 30 * 86400000) });
  for (const [index, status] of demoStages.entries()) {
    const worker = users.get(demoWorkers[index][0]), customer = users.get(customers[index % 3][0]);
    const service = services.get(demoWorkers[index][4]), serviceArea = area(demoWorkers[index][3]);
    const future = status === 'AWAITING_PAYMENT';
    const start = new Date(now); start.setUTCDate(start.getUTCDate() + (future ? 1 : -1)); start.setUTCHours(10, 0, 0, 0);
    if (start.getUTCDay() === 0) start.setUTCDate(start.getUTCDate() + (future ? 1 : -1));
    const end = new Date(+start + 3600000), createdAt = new Date(+start - 86400000);
    const amount = demoWorkers[index][7] * 100;
    await mongoose.connection.transaction(async session => {
      if (await Booking.exists({ _id: demoId('booking:' + status) }).session(session)) return;
      const proposal = await createOnce(DirectProposal, 'proposal:' + status, { customer: customer._id, worker: worker._id, service: service._id, description: `${demoWorkers[index][5]} at my home. Please agree on any materials before starting.`, serviceArea, pricingMode: 'LISTED_PRICE', listedPrice: { type: 'FIXED', amountBututs: amount }, agreedAmountBututs: amount, scheduledStart: start, scheduledEnd: end, expiresAt: start, status: 'ACCEPTED', booking: demoId('booking:' + status), createdAt }, session);
      const activeWork = ['IN_PROGRESS', 'WORKER_MARKED_COMPLETED', 'COMPLETED', 'DISPUTED'].includes(status);
      const marked = ['WORKER_MARKED_COMPLETED', 'COMPLETED', 'DISPUTED'].includes(status);
      const paid = !['AWAITING_PAYMENT', 'CANCELLED'].includes(status);
      const booking = await createOnce(Booking, 'booking:' + status, { customer: customer._id, worker: worker._id, service: service._id, directProposal: proposal._id, description: proposal.description, serviceArea, agreedAmountBututs: amount, status, scheduledStart: start, scheduledEnd: end, createdAt, reservationExpiresAt: future ? new Date(+now + config.BOOKING_RESERVATION_MINUTES * 60000) : new Date(+createdAt + 15 * 60000), ...(activeWork ? { startedAt: start } : {}), ...(marked ? { workerCompletedAt: end, completionNotes: 'The agreed work is finished. Please check it and confirm.' } : {}), ...(status === 'COMPLETED' ? { completedAt: new Date(+end + 60000) } : {}), ...(status === 'CANCELLED' ? { cancelledAt: new Date(+createdAt + 60000), cancellationReason: 'Customer changed their plans before payment.' } : {}) }, session);
      if (paid) {
        const paidAt = new Date(+createdAt + 60000);
        const payment = await createOnce(Payment, 'payment:' + status, { booking: booking._id, customer: customer._id, worker: worker._id, ...breakdown(amount, config.COMMISSION_BASIS_POINTS), provider: 'mock', providerReference: 'demo-' + booking.id, status: status === 'COMPLETED' ? 'RELEASED' : status === 'DISPUTED' ? 'DISPUTED' : 'HELD', paidAt, heldAt: paidAt, ...(status === 'COMPLETED' ? { releasedAt: booking.completedAt } : {}), ...(status === 'DISPUTED' ? { disputedAt: new Date(+end + 60000) } : {}) }, session);
        booking.payment = payment._id; await booking.save({ session });
        for (const [type, value] of [['CUSTOMER_PAYMENT', amount], ['PLATFORM_FEE', payment.platformFeeBututs], ['WORKER_PENDING_EARNING', payment.workerAmountBututs], ...(status === 'COMPLETED' ? [['WORKER_RELEASE', payment.workerAmountBututs]] : [])]) await ledger(payment, type, value, session);
        await createOnce(PaymentAttempt, 'attempt:' + status, { customer: customer._id, booking: booking._id, payment: payment._id, key: 'demo-' + booking.id, outcome: 'SUCCESS', resultStatus: 'HELD', providerReference: payment.providerReference }, session);
      }
      if (status === 'COMPLETED') await WorkerProfile.updateOne({ user: worker._id }, { $inc: { completedJobsCount: 1 } }, { session });
      if (status === 'DISPUTED') await createOnce(Dispute, 'dispute', { booking: booking._id, customer: customer._id, worker: worker._id, reason: 'Part of the cleaning needs checking', description: 'The kitchen was cleaned, but the customer says the bathroom still needs attention. Please review both sides before deciding.', status: 'OPEN' }, session);
      const conversation = await createOnce(Conversation, 'conversation:' + status, { contextType: 'BOOKING', contextId: booking._id, customer: customer._id, worker: worker._id, participants: [customer._id, worker._id], booking: booking._id }, session);
      await createOnce(Message, 'message:' + status, { conversation: conversation._id, sender: customer._id, type: 'TEXT', text: 'Thank you. Please message me before you arrive.', readBy: [customer._id], clientMessageId: 'demo-first-message' }, session);
    });
  }
  await createOnce(DirectProposal, 'pending-offer', { customer: users.get(customers[0][0])._id, worker: users.get('bakary-sanyang')._id, service: services.get('Carpentry')._id, description: 'Please quote for repairing a wooden cupboard door.', serviceArea: area('Brikama'), pricingMode: 'REQUEST_QUOTE', scheduledStart: new Date(+now + 7 * 86400000), scheduledEnd: new Date(+now + 7 * 86400000 + 3600000), expiresAt: new Date(+now + 3 * 86400000) });
  const cleaned = cleanup ? await cleanLegacy(admin._id, localDir) : null;
  const repaired = cleanup ? await repairCarpentry(admin._id, localDir) : 0;
  manifest.bookings = Object.fromEntries(demoStages.map(stage => [stage, String(demoId('booking:' + stage))]));
  manifest.notes = 'Fictional demo accounts. Passwords are initial values; reruns never reset them. Uploaded verification evidence is synthetic, not real identity proof. Awaiting-payment reservation lasts the normal configured period. Changed bookings are never reset.';
  await json(loginPath, manifest);
  return { workers: 10, customers: 3, admin: 1, bookings: 7, openRequests: 3, newProfilePhotos: photos, cleaned, repaired };
}

async function main() {
  let lock;
  const localDir = join(root, '.local-integration', 'demo');
  try {
    const config = loadConfig();
    if (config.NODE_ENV === 'production') throw new Error('Demo seed is restricted to development/test databases.');
    if (config.MEDIA_PROVIDER !== 'cloudinary') throw new Error('Use the configured Cloudinary provider for demo evidence and photos.');
    await mkdir(localDir, { recursive: true });
    try { lock = await open(join(localDir, 'seed.lock'), 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Demo seed is already locked. Check for a running seed before removing a stale seed.lock.'); throw error; }
    await connectDatabase(config.MONGODB_URI); await ensureIndexes();
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('Demo seed requires a MongoDB replica set. No demo records were written.');
    const result = await seedDemo({ config, media: mediaService(new CloudinaryMediaProvider(config)), localDir });
    console.info('Demo seed complete. ' + JSON.stringify(result));
    console.info('Logins and booking references saved locally: backend/.local-integration/demo/demo-logins.json');
  } catch (error) {
    // Provider/database errors may contain secrets; expose only our deliberate operator messages.
    const safe = /^(Demo |Use the configured|Replacement demo|A required demo|Cannot archive)/.test(error.message || '');
    console.error(safe ? error.message : 'Demo seed failed. Check database/Cloudinary connectivity and the seed asset files. Existing financial history was retained; rerun resumes completed steps.');
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
    if (lock) { await lock.close(); await unlink(join(localDir, 'seed.lock')); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
