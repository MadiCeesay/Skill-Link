import { ApiError } from '../utils/ApiError.js';
export function errorHandler(err, req, res, _next) {
  let error = err;
  if (err.code === 11000) error = new ApiError(409, 'ACCOUNT_EXISTS', 'An account with these details already exists');
  else if (err.name === 'ValidationError' || err.name === 'StrictModeError') error = new ApiError(400, 'VALIDATION_ERROR', 'Invalid resource data');
  else if (err.name === 'VersionError') error = new ApiError(409, 'CONCURRENT_UPDATE', 'The resource changed; reload it and retry');
  else if (err.name === 'CastError') error = new ApiError(400, 'INVALID_ID', 'Invalid resource identifier');
  else if (err.type === 'entity.parse.failed') error = new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  else if (err.type === 'entity.too.large') error = new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large');
  const known = error instanceof ApiError;
  if (!known && req.app.get('env') !== 'test') console.error('Unhandled request error:', err.name); // No payloads or credentials.
  res.status(known ? error.status : 500).json({ success: false, error: {
    code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'An unexpected error occurred',
    ...(known && error.details ? { details: error.details } : {}),
  } });
}
