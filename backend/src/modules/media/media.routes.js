import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authorize } from '../../middleware/authorize.js';
import { params, idParams } from '../../utils/validation.js';
import { MEDIA_PURPOSES } from './media.model.js';
import { MAX_UPLOAD_BYTES } from './media.service.js';
import { mediaController } from './media.controller.js';
import { ApiError } from '../../utils/ApiError.js';
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 2, headerPairs: 50 },
  fileFilter(_req, file, callback) {
    if (!['image/jpeg', 'image/png', 'application/pdf', 'audio/ogg', 'audio/webm', 'audio/wav'].includes(file.mimetype)) return callback(new ApiError(400, 'INVALID_MEDIA_TYPE', 'Unsupported upload MIME type'));
    callback(null, true);
  },
}).single('file');
function upload(req, res, next) {
  parser(req, res, error => {
    if (!error) return next();
    if (error instanceof ApiError) return next(error);
    if (error.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'FILE_TOO_LARGE', 'Maximum upload size is 5 MiB'));
    next(new ApiError(400, 'INVALID_UPLOAD', 'Upload exactly one valid file and no additional form fields'));
  });
}
export function mediaRoutes(authenticate, service, { uploadLimit = 30 } = {}) {
  const router = Router();
  const c = mediaController(service);
  router.use(authenticate, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: uploadLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many uploads' } } });
  router.post('/:purpose', params(z.object({ purpose: z.enum(MEDIA_PURPOSES) }).strict()), (req, res, next) => authorize(...(['CHAT_IMAGE','VOICE_NOTE','DISPUTE_EVIDENCE'].includes(req.validatedParams.purpose) ? ['CUSTOMER','WORKER'] : req.validatedParams.purpose === 'JOB_ATTACHMENT' ? ['CUSTOMER'] : ['WORKER']))(req, res, next), limiter, upload, c.upload);
  router.get('/:id/access', authorize('WORKER', 'ADMIN', 'CUSTOMER'), params(idParams('id')), c.access);
  return router;
}
