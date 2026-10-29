import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { params, idParams, query, text } from '../../utils/validation.js';
import { marketPagination } from '../jobRequests/job.validator.js';
import { success } from '../../utils/response.js';
export const accountStatusWrite = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']),
    reason: text(1000),
  })
  .strict();
export function operationsRoutes(protect, service, options = {}) {
  const r = Router();
  r.use('/admin', protect, authorize('ADMIN'), (_q, s, n) => {
    s.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    n();
  });
  const limit = rateLimit({
    windowMs: 900000,
    limit: options.marketWriteLimit ?? 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many administrative mutations',
      },
    },
  });
  r.get('/admin/metrics', async (_q, s) => success(s, await service.metrics()));
  r.get('/admin/health', async (_q, s) => success(s, await service.metrics()));
  for (const name of [
    'users',
    'bookings',
    'payments',
    'ledger',
    'disputes',
    'reviews',
  ])
    r.get('/admin/' + name, query(marketPagination), async (q, s) =>
      success(s, await service[name](q.validatedQuery)),
    );
  r.patch(
    '/admin/users/:id/status',
    params(idParams('id')),
    limit,
    validate(accountStatusWrite),
    async (q, s) =>
      success(
        s,
        await service.status(q.validatedParams.id, q.auth.user, q.validated),
      ),
  );
  r.get('/admin/bookings/:id', params(idParams('id')), async (q, s) =>
    success(s, await service.booking(q.validatedParams.id)),
  );
  r.get('/admin/payments/:id', params(idParams('id')), async (q, s) =>
    success(s, await service.payment(q.validatedParams.id)),
  );
  return r;
}
