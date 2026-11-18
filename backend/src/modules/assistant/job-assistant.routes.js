import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { objectId } from '../../utils/validation.js';
import { success } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

// The customer must give at least one thing to work from: text, a photo or a voice note.
export const jobDraftInput = z.object({
  text: z.string().trim().max(1500).optional(),
  photos: z.array(objectId).max(3).refine(ids => new Set(ids).size === ids.length, 'Duplicate IDs are not allowed').optional(),
  voice: objectId.optional(),
}).strict().refine(v => (v.text && v.text.length >= 3) || v.photos?.length || v.voice, {
  message: 'Describe the problem, add a photo or record a voice note',
});

export function assistantRoutes(protect, service, options = {}) {
  const router = Router();
  router.use('/assistant', protect, authorize('CUSTOMER'), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // AI calls cost money and time, so each customer gets a small hourly allowance.
  const limit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: options.assistantLimit ?? 10,
    keyGenerator: req => String(req.auth.user._id),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'You have used the assistant a lot this hour. Please try again later or describe the job yourself.')),
  });
  router.get('/assistant/status', (_req, res) => success(res, service.status()));
  router.post('/assistant/job-draft', limit, validate(jobDraftInput), async (req, res) =>
    success(res, await service.draftJob(req.auth.user, req.validated)));
  return router;
}
