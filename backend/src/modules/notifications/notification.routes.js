import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { params, idParams, query } from '../../utils/validation.js';
import { marketPagination } from '../jobRequests/job.validator.js';
import { emptyBodySchema } from '../auth/auth.validator.js';
import { success } from '../../utils/response.js';
export function notificationRoutes(protect, service) {
  const r = Router();
  r.use('/notifications', protect, (_q, s, n) => {
    s.set('Cache-Control', 'no-store');
    n();
  });
  r.get('/notifications/me', query(marketPagination), async (q, s) =>
    success(s, await service.list(q.auth.user._id, q.validatedQuery)),
  );
  r.get('/notifications/unread-count', async (q, s) =>
    success(s, await service.unread(q.auth.user._id)),
  );
  r.post('/notifications/read-all', validate(emptyBodySchema), async (q, s) =>
    success(s, await service.readAll(q.auth.user._id)),
  );
  r.post(
    '/notifications/:id/read',
    params(idParams('id')),
    validate(emptyBodySchema),
    async (q, s) =>
      success(s, await service.read(q.validatedParams.id, q.auth.user._id)),
  );
  return r;
}
