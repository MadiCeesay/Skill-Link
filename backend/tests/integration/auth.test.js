import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from '../helpers/mongo-memory.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { Session } from '../../src/modules/auth/session.model.js';
import { authService } from '../../src/modules/auth/auth.service.js';
import { authenticate } from '../../src/middleware/authenticate.js';
import { authorize } from '../../src/middleware/authorize.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import express from 'express';
let mongo, app, config;
const credentials = { firstName: 'Awa', lastName: 'Jallow', email: 'awa@example.test', phoneNumber: '+2207000001', password: 'Strong-password123' };
async function register(role = 'customer', data = {}) { return request(app).post('/api/auth/register/' + role).send({ ...credentials, ...data }); }
async function login() { return request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password }); }
async function signedIn(role = 'customer') { await register(role); return (await login()).body.data; }
async function refresh(token) { return request(app).post('/api/auth/refresh').send({ refreshToken: token }); }
async function me(token) { return request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + token); }
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_ACCESS_SECRET: 'test-access-secret-only-not-for-production-123', JWT_REFRESH_SECRET: 'test-refresh-secret-only-not-for-production-456', FRONTEND_ORIGIN: 'http://localhost:5173' });
  await connectDatabase(config.MONGODB_URI);
  await ensureIndexes();
  app = createApp(config, { authLimit: 10000, globalLimit: 10000 });
});
beforeEach(async () => { await Promise.all([User.deleteMany({}), Session.deleteMany({})]); });
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });
describe('registration and validation', () => {
  it.each(['customer', 'worker'])('registers and logs in a %s with an eight-character password', async role => {
    const password = 'Abcd1234';
    expect((await register(role, { password })).status).toBe(201);
    const result = await request(app).post('/api/auth/login').send({ email: credentials.email, password });
    expect(result.status).toBe(200);
    expect(result.body.data.user.role).toBe(role.toUpperCase());
  });
  it('enforces the eight-character minimum for trusted model creation too', async () => {
    await expect(User.create({ ...credentials, role: 'ADMIN', password: 'Abc1234' })).rejects.toThrow();
    expect(await User.countDocuments()).toBe(0);
  });
  it('registers a customer with safe defaults and no secrets', async () => {
    const r = await register(); expect(r.status).toBe(201); expect(r.body.data.user).toMatchObject({ role: 'CUSTOMER', accountStatus: 'ACTIVE', emailVerified: false });
    expect(JSON.stringify(r.body)).not.toMatch(/password|tokenVersion/);
  });
  it('registers a worker without creating later-phase profiles', async () => { const r = await register('worker'); expect(r.status).toBe(201); expect(r.body.data.user.role).toBe('WORKER'); });
  it('normalizes email and formatted international phone', async () => { const r = await register('customer', { email: ' AWA@EXAMPLE.TEST ', phoneNumber: '+220 700-0001' }); expect(r.status).toBe(201); expect(r.body.data.user.email).toBe(credentials.email); expect(r.body.data.user.phoneNumber).toBe(credentials.phoneNumber); });
  it('hashes passwords with bcrypt cost 12 and hides the hash by default', async () => {
    await register(); expect((await User.findOne()).passwordHash).toBeUndefined();
    const user = await User.findOne().select('+passwordHash'); expect(user.passwordHash).not.toBe(credentials.password); expect(bcrypt.getRounds(user.passwordHash)).toBe(12); expect(await bcrypt.compare(credentials.password, user.passwordHash)).toBe(true); expect(user.toJSON().passwordHash).toBeUndefined();
  });
  it('rejects storing plaintext through passwordHash', async () => { const { password, ...fields } = credentials; await expect(User.create({ ...fields, role: 'CUSTOMER', passwordHash: password })).rejects.toThrow(); expect(await User.countDocuments()).toBe(0); });
  it('rejects duplicate normalized email', async () => { await register(); const r = await register('worker', { email: 'AWA@example.test', phoneNumber: '+2207000002' }); expect(r.status).toBe(409); });
  it('rejects duplicate phone', async () => { await register(); expect((await register('worker', { email: 'other@example.test' })).status).toBe(409); });
  it('enforces unique indexes for simultaneous registration', async () => { const r = await Promise.all([register(), register()]); expect(r.map(x => x.status).sort()).toEqual([201, 409]); expect(await User.countDocuments()).toBe(1); });
  it.each([
    ['missing required name', { firstName: '' }], ['invalid email', { email: 'bad' }], ['invalid phone', { phoneNumber: '7000001' }],
    ['weak password', { password: 'short' }], ['seven-character password', { password: 'Abc1234' }],
    ['no uppercase', { password: 'abcd1234' }], ['no lowercase', { password: 'ABCD1234' }], ['no digit', { password: 'Abcdefgh' }],
    ['bcrypt byte truncation', { password: 'Abc123' + 'é'.repeat(34) }],
    ['role injection', { role: 'ADMIN' }], ['status injection', { accountStatus: 'ACTIVE' }], ['verification injection', { emailVerified: true }],
    ['hash injection', { passwordHash: 'anything' }], ['query injection', { email: { $ne: null } }],
  ])('rejects %s', async (_label, data) => { expect((await register('customer', data)).status).toBe(400); expect(await User.countDocuments()).toBe(0); });
  it('has no public admin registration endpoint', async () => { expect((await register('admin')).status).toBe(404); });
});
describe('login and access authentication', () => {
  it('logs in and accesses the current-user endpoint', async () => { const t = await signedIn(); expect(t.tokenType).toBe('Bearer'); expect(t.expiresIn).toBe(900); expect((await me(t.accessToken)).body.data.user.email).toBe(credentials.email); });
  it('returns the same invalid-credentials response for wrong password and unknown email', async () => {
    await register(); const a = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'wrong' });
    const b = await request(app).post('/api/auth/login').send({ email: 'unknown@example.test', password: 'wrong' });
    expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.body).toEqual(b.body);
  });
  it('validates login bodies', async () => { expect((await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: 'x' })).status).toBe(400); });
  it('rejects login passwords beyond the bcrypt byte limit', async () => { expect((await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'A1' + 'é'.repeat(36) })).status).toBe(400); });
  it('requires a Bearer token', async () => { expect((await request(app).get('/api/auth/me')).status).toBe(401); });
  it('rejects malformed tokens', async () => { expect((await me('invalid')).status).toBe(401); });
  it('rejects an expired access token', async () => {
    const t = await signedIn(); const p = jwt.decode(t.accessToken);
    const token = jwt.sign({ type: 'access', sid: p.sid, ver: p.ver }, config.JWT_ACCESS_SECRET, { algorithm: 'HS256', issuer: 'skilllink-api', audience: 'skilllink-access', subject: p.sub, expiresIn: -1 });
    expect((await me(token)).status).toBe(401);
  });
  it('rejects tokens signed with a different secret', async () => { const t = await signedIn(); const p = jwt.decode(t.accessToken); const token = jwt.sign({ ...p }, 'another-secret'); expect((await me(token)).status).toBe(401); });
  it.each(['HS384', 'HS512'])('rejects a JWT using disallowed algorithm %s', async algorithm => { const t = await signedIn(); const payload = jwt.decode(t.accessToken); const token = jwt.sign(payload, config.JWT_ACCESS_SECRET, { algorithm }); expect((await me(token)).status).toBe(401); });
  it('rejects a JWT with the wrong audience', async () => { const t = await signedIn(); const payload = jwt.decode(t.accessToken); payload.aud = 'another-application'; expect((await me(jwt.sign(payload, config.JWT_ACCESS_SECRET))).status).toBe(401); });
  it('rejects an access JWT without expiration', async () => { const t = await signedIn(); const payload = jwt.decode(t.accessToken); delete payload.exp; expect((await me(jwt.sign(payload, config.JWT_ACCESS_SECRET))).status).toBe(401); });
  it('does not accept refresh tokens as access tokens', async () => { const t = await signedIn(); expect((await me(t.refreshToken)).status).toBe(401); });
  it('uses a live database role rather than a token role', async () => { const t = await signedIn(); await User.updateOne({}, { $set: { role: 'WORKER' } }); expect((await me(t.accessToken)).body.data.user.role).toBe('WORKER'); });
});
describe('refresh rotation and revocation', () => {
  it('rotates refresh tokens and stores only their digest', async () => { const t = await signedIn(); const r = await refresh(t.refreshToken); expect(r.status).toBe(200); expect(r.body.data.refreshToken).not.toBe(t.refreshToken); expect((await me(r.body.data.accessToken)).status).toBe(200); const session = await Session.findOne().select('+refreshTokenHash'); expect(session.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/); expect(session.refreshTokenHash).not.toBe(r.body.data.refreshToken); });
  it('revokes the entire session when a rotated refresh token is reused', async () => { const t = await signedIn(); const r = await refresh(t.refreshToken); expect((await refresh(t.refreshToken)).status).toBe(401); expect((await refresh(r.body.data.refreshToken)).status).toBe(401); expect((await me(r.body.data.accessToken)).status).toBe(401); });
  it('does not allow two simultaneous refreshes to keep a session alive', async () => { const t = await signedIn(); const results = await Promise.all([refresh(t.refreshToken), refresh(t.refreshToken)]); expect(results.map(r => r.status).sort()).toEqual([200, 401]); expect((await me(t.accessToken)).status).toBe(401); });
  it('rejects invalid refresh tokens', async () => { expect((await refresh('invalid')).status).toBe(401); });
  it('rejects access tokens at the refresh endpoint', async () => { const t = await signedIn(); expect((await refresh(t.accessToken)).status).toBe(401); });
  it('validates refresh request bodies', async () => { expect((await request(app).post('/api/auth/refresh').send({})).status).toBe(400); });
  it('rejects expired refresh JWTs', async () => { const t = await signedIn(); const p = jwt.decode(t.refreshToken); const token = jwt.sign({ type: 'refresh', sid: p.sid, ver: p.ver, jti: p.jti }, config.JWT_REFRESH_SECRET, { algorithm: 'HS256', issuer: 'skilllink-api', audience: 'skilllink-refresh', subject: p.sub, expiresIn: -1 }); expect((await refresh(token)).status).toBe(401); });
  it('checks database expiry without waiting for TTL cleanup', async () => { const t = await signedIn(); await Session.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } }); expect((await refresh(t.refreshToken)).status).toBe(401); expect((await me(t.accessToken)).status).toBe(401); });
  it('logout revokes both access and refresh tokens', async () => { const t = await signedIn(); expect((await request(app).post('/api/auth/logout').set('Authorization', 'Bearer ' + t.accessToken)).status).toBe(200); expect((await me(t.accessToken)).status).toBe(401); expect((await refresh(t.refreshToken)).status).toBe(401); });
  it('rejects unexpected logout body fields', async () => { const t = await signedIn(); expect((await request(app).post('/api/auth/logout').set('Authorization', 'Bearer ' + t.accessToken).send({ userId: 'another-user' })).status).toBe(400); expect((await me(t.accessToken)).status).toBe(200); });
  it('logout requires authentication', async () => { expect((await request(app).post('/api/auth/logout')).status).toBe(401); });
  it('logout leaves other sessions intact', async () => { const a = await signedIn(); const b = (await login()).body.data; await request(app).post('/api/auth/logout').set('Authorization', 'Bearer ' + a.accessToken); expect((await me(b.accessToken)).status).toBe(200); });
  it('supports global session invalidation with tokenVersion', async () => { const t = await signedIn(); await User.updateOne({}, { $inc: { tokenVersion: 1 } }); expect((await me(t.accessToken)).status).toBe(401); expect((await refresh(t.refreshToken)).status).toBe(401); });
  it('rejects authentication after user deletion', async () => { const t = await signedIn(); await User.deleteMany({}); expect((await me(t.accessToken)).status).toBe(401); });
});
describe('RBAC and account status', () => {
  function roleApp(roles) { const a = express(); a.get('/restricted', authenticate(authService(config)), authorize(...roles), (_req, res) => res.json({ ok: true })); a.use(errorHandler); return a; }
  it.each(['CUSTOMER', 'WORKER', 'ADMIN'])('allows %s and denies other roles', async role => {
    const t = await signedIn(); await User.updateOne({}, { $set: { role } });
    for (const allowed of ['CUSTOMER', 'WORKER', 'ADMIN']) { const r = await request(roleApp([allowed])).get('/restricted').set('Authorization', 'Bearer ' + t.accessToken); expect(r.status).toBe(allowed === role ? 200 : 403); }
  });
  it('supports multiple allowed roles', async () => { const t = await signedIn('worker'); expect((await request(roleApp(['CUSTOMER', 'WORKER'])).get('/restricted').set('Authorization', 'Bearer ' + t.accessToken)).status).toBe(200); });
  it('requires authentication before RBAC', async () => { expect((await request(roleApp(['ADMIN'])).get('/restricted')).status).toBe(401); });
  it.each(['SUSPENDED', 'DISABLED'])('blocks %s login, access and refresh', async status => { const t = await signedIn(); await User.updateOne({}, { $set: { accountStatus: status } }); expect((await login()).status).toBe(403); expect((await me(t.accessToken)).status).toBe(403); expect((await refresh(t.refreshToken)).status).toBe(403); });
});
describe('HTTP security and errors', () => {
  it('provides a minimal health response', async () => { const r = await request(app).get('/api/health'); expect(r.status).toBe(200); expect(r.body).toEqual({ success: true, data: { status: 'ok' } }); expect(r.headers['x-content-type-options']).toBe('nosniff'); });
  it('returns JSON for unknown routes', async () => { const r = await request(app).get('/missing'); expect(r.status).toBe(404); expect(r.body.error.code).toBe('NOT_FOUND'); });
  it('rejects malformed JSON safely', async () => { const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad'); expect(r.status).toBe(400); expect(r.body.error.code).toBe('INVALID_JSON'); expect(r.body.error.stack).toBeUndefined(); });
  it('limits JSON body size', async () => { const r = await request(app).post('/api/auth/login').send({ data: 'a'.repeat(17000) }); expect(r.status).toBe(413); });
  it('allows only the configured browser origin', async () => { const good = await request(app).get('/api/health').set('Origin', config.FRONTEND_ORIGIN); expect(good.headers['access-control-allow-origin']).toBe(config.FRONTEND_ORIGIN); expect((await request(app).get('/api/health').set('Origin', 'https://untrusted.example')).status).toBe(403); });
  it('rate limits sensitive endpoints using a consistent error body', async () => { const limited = createApp(config, { authLimit: 1 }); const body = { email: 'none@example.test', password: 'wrong' }; expect((await request(limited).post('/api/auth/login').send(body)).status).toBe(401); const r = await request(limited).post('/api/auth/login').send(body); expect(r.status).toBe(429); expect(r.body.error.code).toBe('RATE_LIMITED'); });
  it('marks authentication responses as non-cacheable', async () => { expect((await register()).headers['cache-control']).toBe('no-store'); });
});
