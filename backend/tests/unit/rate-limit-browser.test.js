import { expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
it('keeps the global limit while exposing its cooldown to the allowed browser origin', async () => {
  const config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_ACCESS_SECRET: 'access-only-unit-test-12345678901234567890', JWT_REFRESH_SECRET: 'refresh-only-unit-test-09876543210987654321', FRONTEND_ORIGIN: 'http://localhost:5173' });
  const app = createApp(config, { globalLimit: 1 });
  expect((await request(app).get('/api/health')).status).toBe(200);
  const response = await request(app).get('/api/health').set('Origin', config.FRONTEND_ORIGIN);
  expect(response.status).toBe(429);
  expect(response.body.error.code).toBe('RATE_LIMITED');
  expect(response.headers['x-skilllink-rate-limit']).toBe('global');
  expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  expect(response.headers['access-control-expose-headers']).toContain('Retry-After');
});
