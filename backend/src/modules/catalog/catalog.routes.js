import { Router } from 'express';
import { catalogController as c } from './catalog.controller.js';
import { categoryCreate, categoryUpdate, serviceCreate, serviceUpdate } from './catalog.validator.js';
import { validate } from '../../middleware/validate.js';
import { authorize } from '../../middleware/authorize.js';
import { params, query, idParams, pagination } from '../../utils/validation.js';
export function catalogRoutes(authenticate) {
  const router = Router();
  router.get('/categories', query(pagination), c.categories(false));
  router.get('/services', query(pagination), c.services(false));
  router.get('/categories/:categoryId/services', params(idParams('categoryId')), query(pagination), c.services(false));
  router.get('/admin/catalog/categories', authenticate, authorize('ADMIN'), query(pagination), c.categories(true));
  router.get('/admin/catalog/services', authenticate, authorize('ADMIN'), query(pagination), c.services(true));
  router.post('/categories', authenticate, authorize('ADMIN'), validate(categoryCreate), c.create('Category'));
  router.patch('/categories/:id', authenticate, authorize('ADMIN'), params(idParams('id')), validate(categoryUpdate), c.update('Category'));
  router.post('/services', authenticate, authorize('ADMIN'), validate(serviceCreate), c.create('Service'));
  router.patch('/services/:id', authenticate, authorize('ADMIN'), params(idParams('id')), validate(serviceUpdate), c.update('Service'));
  return router;
}
