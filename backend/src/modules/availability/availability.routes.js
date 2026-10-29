import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  availabilityWrite,
  availableNowWrite,
} from './availability.validator.js';
import { success } from '../../utils/response.js';
export function availabilityRoutes(protect, service) {
  const r = Router();
  r.use('/availability', protect, authorize('WORKER'), (_q, s, n) => {
    s.set('Cache-Control', 'no-store');
    n();
  });
  r.get('/availability/me', async (q, s) =>
    success(s, await service.own(q.auth.user._id)),
  );
  r.patch('/availability/me', validate(availabilityWrite), async (q, s) =>
    success(s, await service.update(q.auth.user._id, q.validated)),
  );
  r.patch(
    '/availability/available-now',
    validate(availableNowWrite),
    async (q, s) =>
      success(s, await service.availableNow(q.auth.user._id, q.validated)),
  );
  return r;
}
