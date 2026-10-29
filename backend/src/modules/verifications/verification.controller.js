import { success } from '../../utils/response.js';
export const verificationController = service => ({
  own: async (req, res) => success(res, await service.own(req.auth.user._id)),
  submit: async (req, res) => success(res, await service.submit(req.auth.user._id, req.validated), 201),
  pending: async (req, res) => success(res, await service.pending(req.validatedQuery)),
  details: async (req, res) => success(res, await service.details(req.validatedParams.id)),
  review: async (req, res) => success(res, await service.review(req.validatedParams.id, req.validated, req.auth.user._id)),
});
