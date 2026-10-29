import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { jobController } from './job.controller.js';
import { quoteController } from '../quotes/quote.controller.js';
import { jobWrite, jobUpdate, jobListQuery, marketPagination } from './job.validator.js';
import { quoteWrite } from '../quotes/quote.validator.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { emptyBodySchema } from '../auth/auth.validator.js';
import { params, query, idParams, objectId } from '../../utils/validation.js';
export function jobRoutes(authenticate, service, quotes, { marketWriteLimit = 60 } = {}) {
  const router = Router(); const c = jobController(service); const q = quoteController(quotes);
  const limit = rateLimit({ windowMs: 900000, limit: marketWriteLimit, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many marketplace write requests' } } });
  router.use('/job-requests', authenticate, (_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); next(); });
  router.post('/job-requests', authorize('CUSTOMER'), limit, validate(jobWrite), c.create);
  router.get('/job-requests/me', authorize('CUSTOMER'), query(jobListQuery), c.list);
  router.get('/job-requests/opportunities', authorize('WORKER'), query(marketPagination), c.opportunities);
  router.get('/job-requests/:id', authorize('CUSTOMER'), params(idParams('id')), c.own);
  router.patch('/job-requests/:id', authorize('CUSTOMER'), params(idParams('id')), limit, validate(jobUpdate), c.update);
  router.post('/job-requests/:id/cancel', authorize('CUSTOMER'), params(idParams('id')), limit, validate(emptyBodySchema), c.cancel);
  router.get('/job-requests/:id/opportunity', authorize('WORKER'), params(idParams('id')), c.opportunity);
  router.get('/job-requests/:id/attachments/:mediaId/access', authorize('CUSTOMER', 'WORKER'), params(z.object({ id: objectId, mediaId: objectId }).strict()), c.attachment);
  router.post('/job-requests/:id/quotes', authorize('WORKER'), params(idParams('id')), limit, validate(quoteWrite), q.submit);
  router.get('/job-requests/:id/quotes', authorize('CUSTOMER'), params(idParams('id')), query(marketPagination), q.received);
  return router;
}
