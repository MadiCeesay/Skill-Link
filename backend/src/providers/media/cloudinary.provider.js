import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
// Only this adapter knows Cloudinary-specific upload and delivery options.
export class CloudinaryMediaProvider {
  constructor(config) {
    this.name = 'cloudinary';
    this.credentials = { cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET, secure: true };
  }
  async upload({ buffer, purpose, owner, format }) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ ...this.credentials, resource_type: purpose === 'VOICE_NOTE' ? 'video' : 'image', type: 'authenticated',
        public_id: 'skilllink/' + purpose.toLowerCase() + '/' + owner + '/' + randomUUID(),
        overwrite: false, allowed_formats: purpose === 'VOICE_NOTE' ? ['ogg','webm','wav'] : ['jpg', 'png', 'pdf'] }, (error, value) => error ? reject(error) : resolve(value));
      stream.end(buffer);
    });
    return { storageKey: result.public_id, resourceType: purpose === 'VOICE_NOTE' ? 'video' : 'image', format: result.format || format, deliveryType: 'authenticated' };
  }
  access(asset, expiresAt) {
    return cloudinary.utils.private_download_url(asset.storageKey, asset.format, { ...this.credentials,
      resource_type: asset.resourceType, type: 'authenticated', expires_at: expiresAt, attachment: true });
  }
  async remove(asset) {
    await cloudinary.uploader.destroy(asset.storageKey, { ...this.credentials, resource_type: asset.resourceType, type: 'authenticated', invalidate: true });
  }
}
