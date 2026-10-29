import { randomUUID } from 'node:crypto';
export class FakeMediaProvider {
  name = 'fake';
  assets = new Map();
  async upload({ buffer, purpose, format }) {
    const storageKey = purpose.toLowerCase() + '/' + randomUUID();
    this.assets.set(storageKey, Buffer.from(buffer));
    return { storageKey, resourceType: 'image', format, deliveryType: 'authenticated' };
  }
  access(asset, expiresAt) { return 'https://media.example.test/' + encodeURIComponent(asset.storageKey) + '?expires_at=' + expiresAt + '&signature=test-only'; }
  async remove(asset) { this.assets.delete(asset.storageKey); }
}
