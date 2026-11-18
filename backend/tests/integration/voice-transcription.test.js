import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from '../helpers/mongo-memory.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { MediaAsset } from '../../src/modules/media/media.model.js';
import { Conversation, Message } from '../../src/modules/conversations/conversation.model.js';
import { Booking } from '../../src/modules/bookings/booking.model.js';
import { FakeMediaProvider } from '../helpers/fake-media.provider.js';

let mongo, config, customer, worker, stranger, conversation, voice;
const media = new FakeMediaProvider();
const mediaFetch = async url => {
  const bytes = media.assets.get(decodeURIComponent(new URL(url).pathname.slice(1)));
  return bytes ? { ok: true, arrayBuffer: async () => bytes } : { ok: false };
};
const transcriberSaying = (text, languageCode = 'wol') => ({ available: true, transcribe: vi.fn(async () => ({ text, languageCode, model: 'scribe_v2' })) });
const appWith = (transcriber, options = {}) => createApp(config, {
  mediaProvider: media, mediaFetch, transcriber, transcribeInBackground: false,
  authLimit: 10000, globalLimit: 10000, marketWriteLimit: 10000, ...options,
});
async function login(app, user) {
  const r = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Test-password123' });
  return r.body.data.accessToken;
}
const sendVoice = async (app, user, clientMessageId = 'voice-' + String(Math.random()).slice(2)) =>
  request(app).post('/api/conversations/' + conversation.id + '/messages').set('Authorization', 'Bearer ' + await login(app, user))
    .send({ type: 'VOICE', media: voice.id, clientMessageId });

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_ACCESS_SECRET: 'voice-access-test-secret-not-production-12345', JWT_REFRESH_SECRET: 'voice-refresh-test-secret-not-production-67890', FRONTEND_ORIGIN: 'http://localhost:5173' });
  await connectDatabase(config.MONGODB_URI); await ensureIndexes();
  const person = (role, i) => User.create({ firstName: role + i, lastName: 'Voice', email: 'voice-' + i + '@example.test', phoneNumber: '+220740000' + i, password: 'Test-password123', role });
  customer = await person('CUSTOMER', 1); worker = await person('WORKER', 2); stranger = await person('CUSTOMER', 3);
});
beforeEach(async () => {
  for (const Model of [MediaAsset, Conversation, Message, Booking]) await Model.deleteMany({});
  conversation = await Conversation.create({ contextType: 'DIRECT_PROPOSAL', contextId: new mongoose.Types.ObjectId(),
    customer: customer._id, worker: worker._id, participants: [customer._id, worker._id] });
  const { storageKey } = await media.upload({ buffer: Buffer.from([7, 7, 7]), purpose: 'VOICE_NOTE', format: 'ogg' });
  voice = await MediaAsset.create({ owner: customer._id, purpose: 'VOICE_NOTE', provider: 'fake', storageKey, resourceType: 'video',
    format: 'ogg', deliveryType: 'authenticated', mimeType: 'audio/ogg', bytes: 3 });
});
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });

describe('Voice-note transcripts', () => {
  it('transcribes a voice note after sending and stores the text and language', async () => {
    const transcriber = transcriberSaying('Water is coming through my ceiling when it rains.');
    const app = appWith(transcriber);
    const sent = await sendVoice(app, customer);
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);
    expect(sent.body.data.message.transcript).toEqual({ status: 'PENDING' });
    expect(transcriber.transcribe).toHaveBeenCalledWith({ buffer: Buffer.from([7, 7, 7]), mimeType: 'audio/ogg', languageCode: undefined });
    const list = await request(app).get('/api/conversations/' + conversation.id + '/messages').set('Authorization', 'Bearer ' + await login(app, worker));
    expect(list.body.data.messages[0].transcript).toEqual({ status: 'DONE', text: 'Water is coming through my ceiling when it rains.', languageCode: 'wol' });
  });

  it('hides a transcript with a spoken phone number until the booking is paid', async () => {
    const app = appWith(transcriberSaying('Call me on 877 123 456 and we can agree outside'));
    await sendVoice(app, customer);
    const saved = await Message.findOne({ type: 'VOICE' });
    expect(saved.transcript.status).toBe('HIDDEN');
    expect(saved.transcript.text).toBeUndefined();
  });

  it('shows the same transcript once the booking is paid', async () => {
    await Booking.collection.insertOne({ directProposal: conversation.contextId, customer: customer._id, worker: worker._id, status: 'CONFIRMED', agreedAmountBututs: 50000 });
    const app = appWith(transcriberSaying('Call me on 877 123 456 when you arrive'));
    await sendVoice(app, customer);
    expect((await Message.findOne({ type: 'VOICE' })).transcript.status).toBe('DONE');
  });

  it('marks the transcript as failed without affecting the message, and allows a retry', async () => {
    const transcriber = { available: true, transcribe: vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce({ text: 'Hello', languageCode: 'eng' }) };
    const app = appWith(transcriber);
    const sent = await sendVoice(app, customer);
    expect(sent.status).toBe(201);
    const message = await Message.findById(sent.body.data.message.id);
    expect(message.transcript.status).toBe('FAILED');
    const token = await login(app, worker);
    const retry = await request(app).post('/api/conversations/' + conversation.id + '/messages/' + message.id + '/transcript').set('Authorization', 'Bearer ' + token).send({});
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.data.message.transcript).toEqual({ status: 'DONE', text: 'Hello', languageCode: 'eng' });
    const again = await request(app).post('/api/conversations/' + conversation.id + '/messages/' + message.id + '/transcript').set('Authorization', 'Bearer ' + token).send({});
    expect(again.status).toBe(409);
  });

  it('only lets conversation participants retry', async () => {
    const app = appWith({ available: true, transcribe: vi.fn(async () => { throw new Error('busy'); }) });
    const sent = await sendVoice(app, customer);
    const r = await request(app).post('/api/conversations/' + conversation.id + '/messages/' + sent.body.data.message.id + '/transcript')
      .set('Authorization', 'Bearer ' + await login(app, stranger)).send({});
    expect(r.status).toBe(404);
  });

  it('passes the language the sender chose to the transcriber', async () => {
    const transcriber = transcriberSaying('Sama kër gi dafa tooy bu taw bi ñëwee');
    const app = appWith(transcriber);
    const r = await request(app).post('/api/conversations/' + conversation.id + '/messages').set('Authorization', 'Bearer ' + await login(app, customer))
      .send({ type: 'VOICE', media: voice.id, clientMessageId: 'voice-wolof', language: 'wol' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.message.spokenLanguage).toBe('wol');
    expect(transcriber.transcribe.mock.calls[0][0].languageCode).toBe('wol');
    const bad = await request(app).post('/api/conversations/' + conversation.id + '/messages').set('Authorization', 'Bearer ' + await login(app, customer))
      .send({ type: 'VOICE', media: voice.id, clientMessageId: 'voice-bad', language: 'xx' });
    expect(bad.status).toBe(400);
  });

  it('sends voice notes without a transcript when transcription is switched off', async () => {
    const app = appWith(undefined);
    const sent = await sendVoice(app, customer);
    expect(sent.status).toBe(201);
    expect(sent.body.data.message).not.toHaveProperty('transcript');
  });
});
