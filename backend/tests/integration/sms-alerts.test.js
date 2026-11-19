import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from '../helpers/mongo-memory.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { notificationService } from '../../src/modules/notifications/notification.service.js';

let mongo, customer;
const settle = () => new Promise((r) => setTimeout(r, 50));
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDatabase(mongo.getUri()); await ensureIndexes();
  customer = await User.create({ firstName: 'Awa', lastName: 'Sms', email: 'awa-sms@example.test', phoneNumber: '+2207012345', password: 'Test-password123', role: 'CUSTOMER' });
});
beforeEach(async () => { await Notification.deleteMany({}); });
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });

describe('SMS alerts', () => {
  it('texts the recipient once for an important event, with no personal details', async () => {
    const sms = { available: true, send: vi.fn(async () => ({ delivered: true })) };
    const service = notificationService({ send: async () => ({}) }, sms, 'https://skilllink-gm.vercel.app');
    const id = new mongoose.Types.ObjectId();
    await service.emit(customer._id, 'NEW_QUOTE', 'Quote', id, 'Quote:' + id + ':NEW_QUOTE');
    await service.emit(customer._id, 'NEW_QUOTE', 'Quote', id, 'Quote:' + id + ':NEW_QUOTE');
    await settle();
    expect(sms.send).toHaveBeenCalledTimes(1);
    expect(sms.send).toHaveBeenCalledWith({ to: '+2207012345', message: 'SkillLink: You received a new offer for your request. Open skilllink-gm.vercel.app' });
  });
  it('does not text for minor events such as chat messages', async () => {
    const sms = { available: true, send: vi.fn() };
    const id = new mongoose.Types.ObjectId();
    await notificationService({ send: async () => ({}) }, sms).emit(customer._id, 'NEW_MESSAGE', 'Message', id, 'm:' + id);
    await settle();
    expect(sms.send).not.toHaveBeenCalled();
  });
  it('keeps the in-app notification when the SMS fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sms = { available: true, send: vi.fn(async () => { throw new Error('HTTP 500'); }) };
    const id = new mongoose.Types.ObjectId();
    const n = await notificationService({ send: async () => ({}) }, sms).emit(customer._id, 'BOOKING_CONFIRMED', 'Booking', id, 'b:' + id);
    await settle();
    expect(n.type).toBe('BOOKING_CONFIRMED');
    expect(await Notification.countDocuments({ recipient: customer._id })).toBe(1);
  });
});
