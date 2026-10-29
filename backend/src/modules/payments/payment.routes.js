import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { params, idParams } from '../../utils/validation.js';
import { checkoutWrite } from './payment.validator.js';
import { success } from '../../utils/response.js';
export function paymentRoutes(protect, service, options = {}) {
  const r = Router();
  r.use(['/payments', '/finances'], protect, (_q, s, n) => {
    s.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    n();
  });
  const limit = rateLimit({
    windowMs: 900000,
    limit: options.paymentLimit ?? 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many payment simulations' },
    },
  });
  r.post(
    '/payments/bookings/:id/checkout',
    authorize('CUSTOMER'),
    params(idParams('id')),
    limit,
    validate(checkoutWrite),
    async (q, s) =>
      success(
        s,
        await service.checkout(q.validatedParams.id, q.auth.user, q.validated),
      ),
  );
  r.get(
    '/payments/bookings/:id',
    authorize('CUSTOMER', 'WORKER'),
    params(idParams('id')),
    async (q, s) =>
      success(s, await service.booking(q.validatedParams.id, q.auth.user)),
  );
  r.get(
    '/payments/:id',
    authorize('CUSTOMER', 'WORKER'),
    params(idParams('id')),
    async (q, s) =>
      success(s, await service.own(q.validatedParams.id, q.auth.user)),
  );
  r.get(
    '/payments/:id/ledger',
    authorize('CUSTOMER', 'WORKER'),
    params(idParams('id')),
    async (q, s) =>
      success(s, await service.entries(q.validatedParams.id, q.auth.user)),
  );
  r.get('/finances/me', authorize('WORKER'), async (q, s) =>
    success(s, await service.balance(q.auth.user._id)),
  );
  return r;
}
