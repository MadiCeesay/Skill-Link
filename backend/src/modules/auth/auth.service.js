import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, publicUser } from '../users/user.model.js';
import { Session } from './session.model.js';
import { tokenService, hashToken } from './token.service.js';
import { seconds } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
const denied = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
export function authService(config) {
  const tokens = tokenService(config);
  // Dummy comparison keeps unknown-email logins on the expensive hashing path.
  const dummyHash = bcrypt.hash('Dummy-password-1234', 12);
  const assertActive = user => {
    if (user.accountStatus !== 'ACTIVE') throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Account is not active');
  };
  async function createSession(user) {
    const id = new mongoose.Types.ObjectId();
    const refreshToken = tokens.issue('refresh', user, id);
    await Session.create({ _id: id, user: user._id, refreshTokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + seconds(config.JWT_REFRESH_EXPIRES_IN) * 1000) });
    return { user: publicUser(user), accessToken: tokens.issue('access', user, id), refreshToken, tokenType: 'Bearer', expiresIn: seconds(config.JWT_ACCESS_EXPIRES_IN) };
  }
  return {
    async register(input, role) {
      if (!['CUSTOMER', 'WORKER'].includes(role)) throw new ApiError(403, 'FORBIDDEN', 'Public administrator registration is unavailable');
      // Registration creates the account only; login explicitly creates a session.
      const { firstName, lastName, email, phoneNumber, password } = input;
      const user = new User({ firstName, lastName, email, phoneNumber, password, role });
      await user.save();
      return { user: publicUser(user) };
    },
    async login({ email, password }) {
      const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
      const matches = await bcrypt.compare(password, user?.passwordHash ?? await dummyHash);
      if (!user || !matches) throw denied();
      assertActive(user);
      return createSession(user);
    },
    async refresh(refreshToken) {
      const p = tokens.verify('refresh', refreshToken);
      const user = await User.findById(p.sub).select('+tokenVersion');
      if (!user || user.tokenVersion !== p.ver) throw new ApiError(401, 'SESSION_REVOKED', 'Session is no longer valid');
      assertActive(user);
      const nextRefresh = tokens.issue('refresh', user, p.sid);
      // Atomic compare-and-swap: only one request can consume the current token.
      const session = await Session.findOneAndUpdate({ _id: p.sid, user: user._id, refreshTokenHash: hashToken(refreshToken), revokedAt: null, expiresAt: mongoose.trusted({ $gt: new Date() }) },
        { $set: { refreshTokenHash: hashToken(nextRefresh) } }, { new: true });
      if (!session) {
        // A verified stale token signals possible theft. Revoke its entire session.
        await Session.updateOne({ _id: p.sid, user: user._id }, { $set: { revokedAt: new Date() } });
        throw new ApiError(401, 'SESSION_REVOKED', 'Refresh token was already used or the session expired');
      }
      return { accessToken: tokens.issue('access', user, p.sid), refreshToken: nextRefresh, tokenType: 'Bearer', expiresIn: seconds(config.JWT_ACCESS_EXPIRES_IN) };
    },
    async logout(sessionId, userId) {
      await Session.updateOne({ _id: sessionId, user: userId }, { $set: { revokedAt: new Date() } });
    },
    async authenticate(accessToken) {
      const p = tokens.verify('access', accessToken);
      const [user, session] = await Promise.all([
        User.findById(p.sub).select('+tokenVersion'),
        Session.findOne({ _id: p.sid, user: p.sub, revokedAt: null, expiresAt: mongoose.trusted({ $gt: new Date() }) }),
      ]);
      if (!user || !session || user.tokenVersion !== p.ver) throw new ApiError(401, 'SESSION_REVOKED', 'Session is no longer valid');
      assertActive(user);
      return { user, sessionId: session.id };
    },
  };
}
