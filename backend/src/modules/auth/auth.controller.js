import { success } from '../../utils/response.js';
import { publicUser } from '../users/user.model.js';
export const authController = service => ({
  register: role => async (req, res) => success(res, await service.register(req.validated, role), 201),
  login: async (req, res) => success(res, await service.login(req.validated)),
  refresh: async (req, res) => success(res, await service.refresh(req.validated.refreshToken)),
  logout: async (req, res) => { await service.logout(req.auth.sessionId, req.auth.user._id); return success(res, { message: 'Logged out' }); },
  me: (req, res) => success(res, { user: publicUser(req.auth.user) }),
});
