import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { registrationSchema, loginSchema, refreshSchema, emptyBodySchema } from './auth.validator.js';
export function authRoutes(service, { authLimit = 30 } = {}) {
  const router = Router();
  const c = authController(service);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: authLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts; try again later' } } });
  router.post('/register/customer', limiter, validate(registrationSchema), c.register('CUSTOMER'));
  router.post('/register/worker', limiter, validate(registrationSchema), c.register('WORKER'));
  router.post('/login', limiter, validate(loginSchema), c.login);
  router.post('/refresh', limiter, validate(refreshSchema), c.refresh);
  router.post('/logout', authenticate(service), validate(emptyBodySchema), c.logout);
  router.get('/me', authenticate(service), c.me);
  return router;
}
