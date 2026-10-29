import { ApiError } from '../utils/ApiError.js';
export const authenticate = service => async (req, _res, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  if (!match) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A Bearer access token is required');
  req.auth = await service.authenticate(match[1]);
  next();
};
