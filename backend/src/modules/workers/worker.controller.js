import { success } from '../../utils/response.js';
export const workerController = service => ({
  own: async (req, res) => success(res, await service.own(req.auth.user._id)),
  listPortfolio: async (req, res) => success(res, { portfolio: (await service.own(req.auth.user._id)).profile.portfolio }),
  create: async (req, res) => success(res, await service.create(req.auth.user, req.validated), 201),
  update: async (req, res) => success(res, await service.update(req.auth.user._id, req.validated)),
  portfolio: action => async (req, res) => success(res, await service.portfolio(req.auth.user._id, action, req.validated, req.validatedParams?.itemId), action === 'add' ? 201 : 200),
  public: async (req, res) => { res.set('Cache-Control', 'no-store'); return success(res, await service.public(req.validatedParams.workerId)); },
  inspect: async (req, res) => { res.set('Cache-Control', 'no-store'); return success(res, await service.inspect(req.validatedParams.workerId)); },
});
