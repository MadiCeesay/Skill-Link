import { catalogService } from './catalog.service.js';
import { success } from '../../utils/response.js';
export const catalogController = {
  categories: admin => async (req, res) => success(res, await catalogService.listCategories(req.validatedQuery, admin)),
  services: admin => async (req, res) => success(res, await catalogService.listServices(req.validatedQuery, req.validatedParams?.categoryId, admin)),
  create: kind => async (req, res) => success(res, await catalogService.create(kind, req.validated, req.auth.user._id), 201),
  update: kind => async (req, res) => success(res, await catalogService.update(kind, req.validatedParams.id, req.validated, req.auth.user._id)),
};
