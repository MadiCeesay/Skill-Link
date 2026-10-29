import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { quoteController } from './quote.controller.js';
import { quoteUpdate } from './quote.validator.js';
import { marketPagination } from '../jobRequests/job.validator.js';
import { emptyBodySchema } from '../auth/auth.validator.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { params, query, idParams } from '../../utils/validation.js';
export function quoteRoutes(authenticate, service, { marketWriteLimit = 60 } = {}) {
  const router = Router(); const c = quoteController(service);
  const limit = rateLimit({ windowMs: 900000, limit: marketWriteLimit, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many quote write requests' } } });
  router.use('/quotes', authenticate, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/quotes/me', authorize('WORKER'), query(marketPagination), c.list);
  router.get('/quotes/:id', authorize('WORKER'), params(idParams('id')), c.own);
  router.patch('/quotes/:id', authorize('WORKER'), params(idParams('id')), limit, validate(quoteUpdate), c.update);
  router.post('/quotes/:id/withdraw', authorize('WORKER'), params(idParams('id')), limit, validate(emptyBodySchema), c.withdraw);
  router.post('/quotes/:id/accept', authorize('CUSTOMER'), params(idParams('id')), limit, validate(emptyBodySchema), c.accept);
  return router;
}
