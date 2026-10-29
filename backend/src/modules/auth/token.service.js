import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
const issuer = 'skilllink-api';
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function tokenService(config) {
  const settings = type => ({ algorithm: 'HS256', issuer, audience: 'skilllink-' + type,
    expiresIn: type === 'access' ? config.JWT_ACCESS_EXPIRES_IN : config.JWT_REFRESH_EXPIRES_IN });
  const secret = type => type === 'access' ? config.JWT_ACCESS_SECRET : config.JWT_REFRESH_SECRET;
  return {
    issue(type, user, sessionId) {
      return jwt.sign({ type, sid: String(sessionId), ver: user.tokenVersion, jti: randomUUID() }, secret(type), { ...settings(type), subject: String(user._id) });
    },
    verify(type, token) {
      try {
        const p = jwt.verify(token, secret(type), { algorithms: ['HS256'], issuer, audience: 'skilllink-' + type });
        if (p.type !== type || !mongoose.isObjectIdOrHexString(p.sub) || !mongoose.isObjectIdOrHexString(p.sid) || !Number.isInteger(p.ver) || typeof p.jti !== 'string' || !Number.isFinite(p.exp)) throw new Error();
        return p;
      } catch { throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired authentication token'); }
    },
  };
}
