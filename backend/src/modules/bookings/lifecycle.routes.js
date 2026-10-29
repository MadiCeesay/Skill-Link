import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { params, idParams, objectId, query } from '../../utils/validation.js';
import { marketPagination } from '../jobRequests/job.validator.js';
import { emptyBodySchema } from '../auth/auth.validator.js';
import {
  completionWrite,
  disputeWrite,
  disputeDecision,
  reviewWrite,
  reviewModerate,
} from './lifecycle.validator.js';
import { success } from '../../utils/response.js';
export function lifecycleRoutes(protect, service, options = {}) {
  const r = Router();
  const limit = rateLimit({
    windowMs: 900000,
    limit: options.marketWriteLimit ?? 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many lifecycle actions' },
    },
  });
  const action =
    (name, status = 200) =>
    async (q, s) =>
      success(
        s,
        await service[name](q.validatedParams.id, q.auth.user, q.validated),
        status,
      );
  r.get(
    '/workers/:id/reviews',
    params(idParams('id')),
    query(marketPagination),
    async (q, s) =>
      success(s, await service.reviews(q.validatedParams.id, q.validatedQuery)),
  );
  r.use(
    ['/bookings', '/disputes', '/admin/disputes', '/admin/reviews'],
    protect,
    (_q, s, n) => {
      s.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      n();
    },
  );
  r.post(
    '/bookings/:id/start',
    authorize('WORKER'),
    params(idParams('id')),
    limit,
    validate(emptyBodySchema),
    action('start'),
  );
  r.post(
    '/bookings/:id/complete',
    authorize('WORKER'),
    params(idParams('id')),
    limit,
    validate(completionWrite),
    action('complete'),
  );
  r.post(
    '/bookings/:id/confirm-completion',
    authorize('CUSTOMER'),
    params(idParams('id')),
    limit,
    validate(emptyBodySchema),
    action('confirm'),
  );
  r.post(
    '/bookings/:id/dispute',
    authorize('CUSTOMER'),
    params(idParams('id')),
    limit,
    validate(disputeWrite),
    action('dispute', 201),
  );
  r.post(
    '/bookings/:id/reviews',
    authorize('CUSTOMER'),
    params(idParams('id')),
    limit,
    validate(reviewWrite),
    action('review', 201),
  );
  r.get(
    '/disputes/:id',
    authorize('CUSTOMER', 'WORKER'),
    params(idParams('id')),
    action('disputeOwn'),
  );
  r.get(
    '/bookings/:id/evidence/:mediaId/access',
    authorize('CUSTOMER', 'WORKER', 'ADMIN'),
    params(z.object({ id: objectId, mediaId: objectId }).strict()),
    async (q, s) =>
      success(
        s,
        await service.evidence(
          q.validatedParams.id,
          q.validatedParams.mediaId,
          q.auth.user,
        ),
      ),
  );
  r.get(
    '/admin/disputes/:id',
    authorize('ADMIN'),
    params(idParams('id')),
    action('disputeOwn'),
  );
  r.post(
    '/admin/disputes/:id/resolve',
    authorize('ADMIN'),
    params(idParams('id')),
    limit,
    validate(disputeDecision),
    action('resolve'),
  );
  r.patch(
    '/admin/reviews/:id/moderation',
    authorize('ADMIN'),
    params(idParams('id')),
    limit,
    validate(reviewModerate),
    action('moderate'),
  );
  return r;
}
