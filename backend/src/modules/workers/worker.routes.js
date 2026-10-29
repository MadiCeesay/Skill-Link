import { Router } from 'express';
import { workerController } from './worker.controller.js';
import { profileCreate, profileUpdate, portfolioCreate, portfolioUpdate } from './worker.validator.js';
import { validate } from '../../middleware/validate.js';
import { authorize } from '../../middleware/authorize.js';
import { params, idParams } from '../../utils/validation.js';
export function workerRoutes(authenticate, service) {
  const router = Router();
  const c = workerController(service);
  const worker = [authenticate, authorize('WORKER'), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }];
  router.get('/workers/me/profile', ...worker, c.own);
  router.post('/workers/me/profile', ...worker, validate(profileCreate), c.create);
  router.patch('/workers/me/profile', ...worker, validate(profileUpdate), c.update);
  router.get('/workers/me/portfolio', ...worker, c.listPortfolio);
  router.post('/workers/me/portfolio', ...worker, validate(portfolioCreate), c.portfolio('add'));
  router.patch('/workers/me/portfolio/:itemId', ...worker, params(idParams('itemId')), validate(portfolioUpdate), c.portfolio('update'));
  router.delete('/workers/me/portfolio/:itemId', ...worker, params(idParams('itemId')), c.portfolio('remove'));
  router.get('/workers/:workerId', params(idParams('workerId')), c.public);
  router.get('/admin/workers/:workerId', authenticate, authorize('ADMIN'), params(idParams('workerId')), c.inspect);
  return router;
}
