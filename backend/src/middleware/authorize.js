import { ApiError } from '../utils/ApiError.js';
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.auth) return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required'));
  if (!roles.includes(req.auth.user.role)) return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action'));
  next();
};
