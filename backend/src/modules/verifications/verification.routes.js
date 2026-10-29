import { Router } from 'express';
import { verificationController } from './verification.controller.js';
import { verificationSubmit, verificationDecision } from './verification.validator.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { params, query, idParams, pagination } from '../../utils/validation.js';
export function verificationRoutes(authenticate, service) {
  const router = Router();
  const c = verificationController(service);
  router.use(['/verifications', '/admin/verifications'], authenticate, (_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); next(); });
  router.get('/verifications/me', authorize('WORKER'), c.own);
  router.post('/verifications', authorize('WORKER'), validate(verificationSubmit), c.submit);
  router.get('/admin/verifications', authorize('ADMIN'), query(pagination), c.pending);
  router.get('/admin/verifications/:id', authorize('ADMIN'), params(idParams('id')), c.details);
  router.patch('/admin/verifications/:id', authorize('ADMIN'), params(idParams('id')), validate(verificationDecision), c.review);
  return router;
}
