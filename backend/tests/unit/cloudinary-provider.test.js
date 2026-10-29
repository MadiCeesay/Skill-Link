import { afterEach, describe, it, expect, vi } from 'vitest';
import { Writable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryMediaProvider } from '../../src/providers/media/cloudinary.provider.js';
const config = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: '123456789012345', CLOUDINARY_API_SECRET: 'test-only-signing-secret' };
afterEach(() => vi.restoreAllMocks());
describe('Cloudinary provider contract without live credentials', () => {
  it('uploads all purposes as authenticated with generated immutable identifiers', async () => {
    let captured;
    vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options, callback) => {
      captured = options;
      return new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { callback(null, { public_id: options.public_id, format: 'png' }); done(); } });
    });
    const provider = new CloudinaryMediaProvider(config);
    const result = await provider.upload({ buffer: Buffer.from('test fixture'), purpose: 'IDENTITY_DOCUMENT', owner: 'worker-id', format: 'png' });
    expect(captured.type).toBe('authenticated'); expect(captured.overwrite).toBe(false); expect(captured.public_id).toMatch(/^skilllink\/identity_document\/worker-id\//);
    expect(result.deliveryType).toBe('authenticated'); expect(result).not.toHaveProperty('url');
  });
  it('generates expiring authenticated download URLs rather than permanent CDN signatures', () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const url = new CloudinaryMediaProvider(config).access({ storageKey: 'private/test', resourceType: 'image', format: 'pdf' }, expiresAt);
    const parsed = new URL(url);
    expect(parsed.protocol).toBe('https:'); expect(parsed.hostname).toBe('api.cloudinary.com');
    expect(parsed.searchParams.get('expires_at')).toBe(String(expiresAt)); expect(parsed.searchParams.get('type')).toBe('authenticated');
    expect(parsed.searchParams.get('signature')).toBeTruthy(); expect(url).not.toContain(config.CLOUDINARY_API_SECRET);
  });
  it('deletes using the original protected delivery type', async () => {
    const destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
    await new CloudinaryMediaProvider(config).remove({ storageKey: 'private/test', resourceType: 'image' });
    expect(destroy).toHaveBeenCalledWith('private/test', expect.objectContaining({ type: 'authenticated', invalidate: true }));
  });
});
