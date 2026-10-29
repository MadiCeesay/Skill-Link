import { audioFormat } from './audio.validator.js';
import sharp from 'sharp';
import mongoose from 'mongoose';
import { MediaAsset, mediaDTO } from './media.model.js';
import { ApiError } from '../../utils/ApiError.js';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const imagePurposes = ['PORTFOLIO', 'PROFILE_IMAGE'];
export function mediaService(provider) {
  return {
    async upload(user, purpose, file) {
      if (!file) throw new ApiError(400, 'FILE_REQUIRED', 'Upload one file using the file field');
      if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE', 'Maximum upload size is 5 MiB');
      let buffer = file.buffer;
      let format;
      if(purpose==='VOICE_NOTE'){format=audioFormat(buffer,file.mimetype);} else if (file.mimetype === 'application/pdf' && ['IDENTITY_DOCUMENT','SKILL_CERTIFICATE','WORK_EVIDENCE'].includes(purpose)) {
        if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) || !buffer.subarray(-1024).includes(Buffer.from('%%EOF'))) throw new ApiError(400, 'INVALID_FILE', 'Malformed PDF document');
        format = 'pdf';
      } else if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
        try {
          const decoder = sharp(buffer, { limitInputPixels: 20000000, failOn: 'warning' });
          const metadata = await decoder.metadata();
          format = file.mimetype === 'image/jpeg' ? 'jpeg' : 'png';
          if (metadata.format !== format || (metadata.pages || 1) > 1) throw new Error('Format mismatch');
          // Decode/re-encode; do not retain EXIF/GPS or arbitrary appended content.
          buffer = await decoder.rotate().toFormat(format).toBuffer();
          if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('Decoded image exceeds limit');
          if (format === 'jpeg') format = 'jpg';
        } catch { throw new ApiError(400, 'INVALID_FILE', 'Upload a valid, non-animated JPEG or PNG within image limits'); }
      } else { throw new ApiError(400, 'INVALID_MEDIA_TYPE', 'This media purpose does not accept that file type'); }
      let stored;
      try { stored = await provider.upload({ buffer, purpose, owner: String(user._id), format }); }
      catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(502, 'MEDIA_PROVIDER_ERROR', 'Media storage could not accept the upload'); }
      try {
        const asset = await MediaAsset.create({ owner: user._id, purpose, mimeType: file.mimetype, bytes: buffer.length, provider: provider.name, ...stored });
        return mediaDTO(asset);
      } catch (error) {
        // Best effort compensation if the database write fails after upload.
        try { await provider.remove(stored); } catch { /* An operator may need to remove an orphaned asset. */ }
        throw error;
      }
    },
    async owned(id, owner, purpose, session = null) {
      const asset = await MediaAsset.findOne({ _id: id, owner, purpose }).session(session);
      if (!asset) throw new ApiError(400, 'INVALID_MEDIA', 'Select your own uploaded media with the correct purpose');
      return asset;
    },
    async ownedMany(ids, owner, purpose, session = null) {
      if (!ids.length) return [];
      const docs = await MediaAsset.find({ _id: mongoose.trusted({ $in: ids }), owner, purpose }).session(session);
      if (docs.length !== ids.length) throw new ApiError(400, 'INVALID_MEDIA', 'Select your own uploaded media with the correct purpose');
      return docs;
    },
    async access(id, user) {
      if (user.role === 'CUSTOMER' && !await MediaAsset.exists({ _id: id, owner: user._id, purpose: mongoose.trusted({$in:['JOB_ATTACHMENT','CHAT_IMAGE','VOICE_NOTE','DISPUTE_EVIDENCE']}) })) throw new ApiError(403, 'FORBIDDEN', 'Customers may access only their own job attachments');
      const asset = await MediaAsset.findOne({ _id: id, ...(user.role === 'ADMIN' ? {} : { owner: user._id }) }).select('+storageKey +resourceType +format +deliveryType');
      if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Media not found');
      return this.link(asset, 60);
    },
    async link(asset, lifetime = 60) {
      if (asset.provider !== provider.name) throw new ApiError(503, 'MEDIA_UNAVAILABLE', 'The stored media provider is unavailable');
      const expiresAt = Math.floor(Date.now() / 1000) + lifetime;
      try { return { url: await provider.access(asset, expiresAt), expiresAt }; }
      catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(502, 'MEDIA_PROVIDER_ERROR', 'Media could not be accessed'); }
    },
    async jobAttachment(id, owner) {
      const asset = await MediaAsset.findOne({ _id: id, owner, purpose: 'JOB_ATTACHMENT' }).select('+storageKey +resourceType +format +deliveryType');
      if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Attachment not found');
      return this.link(asset, 60);
    },
    async publicImage(id) {
      if (!id) return null;
      const asset = await MediaAsset.findOne({ _id: id, purpose: mongoose.trusted({ $in: imagePurposes }) }).select('+storageKey +resourceType +format +deliveryType');
      if (!asset) return null;
      return { ...mediaDTO(asset), ...await this.link(asset, 300) };
    },
  };
}
