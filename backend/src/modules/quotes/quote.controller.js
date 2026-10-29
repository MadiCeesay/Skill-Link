import { success } from '../../utils/response.js';
export const quoteController = service => ({
  submit: async (req, res) => success(res, await service.submit(req.validatedParams.id, req.auth.user._id, req.validated), 201),
  received: async (req, res) => success(res, await service.received(req.validatedParams.id, req.auth.user._id, req.validatedQuery)),
  list: async (req, res) => success(res, await service.list(req.auth.user._id, req.validatedQuery)),
  own: async (req, res) => success(res, await service.own(req.validatedParams.id, req.auth.user._id)),
  update: async (req, res) => success(res, await service.change(req.validatedParams.id, req.auth.user._id, req.validated)),
  withdraw: async (req, res) => success(res, await service.change(req.validatedParams.id, req.auth.user._id, {}, true)),
  accept: async (req, res) => success(res, await service.accept(req.validatedParams.id, req.auth.user._id)),
});
