import { describe, it, expect } from 'vitest';
import { loadConfig, seconds } from '../../src/config/env.js';
const base = { MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40), FRONTEND_ORIGIN: 'http://localhost:5173' };
describe('configuration validation', () => {
  it('loads secure defaults', () => { expect(loadConfig(base)).toMatchObject({ PORT: 5000, JWT_ACCESS_EXPIRES_IN: '15m', JWT_REFRESH_EXPIRES_IN: '7d' }); });
  it('rejects missing secrets without printing secret values', () => { expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'sensitive' })).toThrow('JWT_ACCESS_SECRET'); try { loadConfig({ ...base, JWT_ACCESS_SECRET: 'sensitive' }); } catch (e) { expect(e.message).not.toContain('sensitive'); } });
  it('requires different secrets', () => { expect(() => loadConfig({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toThrow('different'); });
  it.each(['0m', 'forever', '1000', '2h'])('rejects invalid or excessive access lifetime %s', v => { expect(() => loadConfig({ ...base, JWT_ACCESS_EXPIRES_IN: v })).toThrow(); });
  it('bounds the refresh lifetime', () => { expect(() => loadConfig({ ...base, JWT_REFRESH_EXPIRES_IN: '31d' })).toThrow(); });
  it('requires a longer refresh lifetime', () => { expect(() => loadConfig({ ...base, JWT_REFRESH_EXPIRES_IN: '1m' })).toThrow(); });
  it('requires HTTPS frontend origin in production', () => { expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow('HTTPS'); });
  it('rejects non-origin frontend URLs', () => { expect(() => loadConfig({ ...base, FRONTEND_ORIGIN: 'https://example.test/path' })).toThrow(); });
  it('reports malformed origins as configuration errors', () => { expect(() => loadConfig({ ...base, FRONTEND_ORIGIN: 'not-a-url' })).toThrow('FRONTEND_ORIGIN'); });
  it('converts explicit token duration units', () => { expect(seconds('15m')).toBe(900); expect(seconds('7d')).toBe(604800); });
});
