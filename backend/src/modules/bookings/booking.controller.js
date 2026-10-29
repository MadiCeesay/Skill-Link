import { success } from '../../utils/response.js';
export const bookingController = (s) => ({
  attachment: async (req, res) => success(res, await s.attachment(req.validatedParams.id, req.validatedParams.mediaId, req.auth.user)),
  sendQuote: async (req, res) => success(res, await s.sendQuote(req.validatedParams.id, req.auth.user, req.validated)),
  acceptQuote: async (req, res) => success(res, await s.acceptQuote(req.validatedParams.id, req.auth.user, req.validated)),
  fromQuote: async (req, res) =>
    success(res, await s.fromQuote(req.auth.user._id, req.validated), 201),
  propose: async (req, res) =>
    success(res, await s.propose(req.auth.user._id, req.validated), 201),
  proposals: async (req, res) =>
    success(res, await s.proposals(req.auth.user, req.validatedQuery)),
  proposal: async (req, res) =>
    success(res, await s.proposal(req.validatedParams.id, req.auth.user)),
  decide: (action) => async (req, res) =>
    success(res, await s.decide(req.validatedParams.id, req.auth.user, action)),
  own: async (req, res) =>
    success(res, await s.own(req.validatedParams.id, req.auth.user)),
  list: async (req, res) =>
    success(res, await s.list(req.auth.user, req.validatedQuery)),
  cancel: async (req, res) =>
    success(
      res,
      await s.cancel(req.validatedParams.id, req.auth.user, req.validated),
    ),
});
