import { success } from '../../utils/response.js';
export const jobController = service => ({
  create: async (req, res) => success(res, await service.create(req.auth.user._id, req.validated), 201),
  list: async (req, res) => success(res, await service.list(req.auth.user._id, req.validatedQuery)),
  own: async (req, res) => success(res, await service.own(req.validatedParams.id, req.auth.user._id)),
  update: async (req, res) => success(res, await service.update(req.validatedParams.id, req.auth.user._id, req.validated)),
  cancel: async (req, res) => success(res, await service.cancel(req.validatedParams.id, req.auth.user._id)),
  opportunities: async (req, res) => success(res, await service.opportunities(req.auth.user._id, req.validatedQuery)),
  opportunity: async (req, res) => success(res, await service.opportunity(req.validatedParams.id, req.auth.user._id)),
  attachment: async (req, res) => success(res, await service.attachment(req.validatedParams.id, req.validatedParams.mediaId, req.auth.user)),
});
