import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
const base = { MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40), FRONTEND_ORIGIN: 'http://localhost:5173' };
describe('Phase 2 media configuration', () => {
  it('preserves authentication without media credentials', () => { expect(loadConfig(base).MEDIA_PROVIDER).toBe('disabled'); });
  it('accepts empty credential placeholders while disabled', () => { expect(loadConfig({ ...base, CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '' }).MEDIA_PROVIDER).toBe('disabled'); });
  it('requires credentials when Cloudinary is selected', () => { expect(() => loadConfig({ ...base, MEDIA_PROVIDER: 'cloudinary' })).toThrow('CLOUDINARY'); });
  it('rejects partial credentials', () => { expect(() => loadConfig({ ...base, CLOUDINARY_CLOUD_NAME: 'test' })).toThrow('CLOUDINARY'); });
  it('loads complete Cloudinary credentials', () => { expect(loadConfig({ ...base, MEDIA_PROVIDER: 'cloudinary', CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' }).MEDIA_PROVIDER).toBe('cloudinary'); });
  it('does not expose credential values in validation errors', () => { try { loadConfig({ ...base, CLOUDINARY_API_SECRET: 'never-log-this' }); } catch (e) { expect(e.message).not.toContain('never-log-this'); } });
  it('does not allow a fake production storage provider', () => { expect(() => loadConfig({ ...base, MEDIA_PROVIDER: 'fake' })).toThrow('MEDIA_PROVIDER'); });
});
