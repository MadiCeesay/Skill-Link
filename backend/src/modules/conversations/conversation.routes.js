import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { params, idParams, objectId, query } from '../../utils/validation.js';
import { marketPagination } from '../jobRequests/job.validator.js';
import { emptyBodySchema } from '../auth/auth.validator.js';
import { conversationWrite, messageWrite } from './conversation.validator.js';
import { success } from '../../utils/response.js';
export function conversationRoutes(
  protect,
  service,
  publish = () => {},
  options = {},
) {
  const r = Router();
  r.use(
    '/conversations',
    protect,
    authorize('CUSTOMER', 'WORKER'),
    (_q, s, n) => {
      s.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      n();
    },
  );
  const limit = rateLimit({
    windowMs: 60000,
    limit: options.messageLimit ?? 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many messaging actions' },
    },
  });
  r.post('/conversations', limit, validate(conversationWrite), async (q, s) =>
    success(s, await service.create(q.auth.user, q.validated), 201),
  );
  r.get('/conversations/me', query(marketPagination), async (q, s) =>
    success(s, await service.list(q.auth.user, q.validatedQuery)),
  );
  r.get('/conversations/:id', params(idParams('id')), async (q, s) =>
    success(s, await service.get(q.validatedParams.id, q.auth.user)),
  );
  r.get(
    '/conversations/:id/messages',
    params(idParams('id')),
    query(marketPagination),
    async (q, s) =>
      success(
        s,
        await service.history(
          q.validatedParams.id,
          q.auth.user,
          q.validatedQuery,
        ),
      ),
  );
  r.post(
    '/conversations/:id/messages',
    params(idParams('id')),
    limit,
    validate(messageWrite),
    async (q, s) => {
      const data = await service.send(
        q.validatedParams.id,
        q.auth.user,
        q.validated,
      );
      await publish(q.validatedParams.id, 'message', data);
      success(s, data, 201);
    },
  );
  r.post(
    '/conversations/:id/read',
    params(idParams('id')),
    limit,
    validate(emptyBodySchema),
    async (q, s) =>
      success(s, await service.read(q.validatedParams.id, q.auth.user)),
  );
  r.get(
    '/conversations/:id/media/:mediaId/access',
    params(z.object({ id: objectId, mediaId: objectId }).strict()),
    async (q, s) =>
      success(
        s,
        await service.access(
          q.validatedParams.id,
          q.validatedParams.mediaId,
          q.auth.user,
        ),
      ),
  );
  return r;
}
