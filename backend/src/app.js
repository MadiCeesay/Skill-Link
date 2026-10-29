import {
  notificationService,
  notifying,
} from './modules/notifications/notification.service.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { DisabledEmailProvider } from './providers/email/disabled.provider.js';
import { operationsService } from './modules/admin/operations.service.js';
import { operationsRoutes } from './modules/admin/operations.routes.js';
import { lifecycleService } from './modules/bookings/lifecycle.service.js';
import { lifecycleRoutes } from './modules/bookings/lifecycle.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { paymentService } from './modules/payments/payment.service.js';
import { MockPaymentProvider } from './providers/payments/mock.provider.js';
import { conversationService } from './modules/conversations/conversation.service.js';
import { conversationRoutes } from './modules/conversations/conversation.routes.js';
import { availabilityRoutes } from './modules/availability/availability.routes.js';
import { availabilityService } from './modules/availability/availability.service.js';
import { bookingRoutes } from './modules/bookings/booking.routes.js';
import { bookingService } from './modules/bookings/booking.service.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { authService } from './modules/auth/auth.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ApiError } from './utils/ApiError.js';
import { success } from './utils/response.js';
import { authenticate } from './middleware/authenticate.js';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { workerRoutes } from './modules/workers/worker.routes.js';
import { workerService } from './modules/workers/worker.service.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { mediaService } from './modules/media/media.service.js';
import { verificationRoutes } from './modules/verifications/verification.routes.js';
import { verificationService } from './modules/verifications/verification.service.js';
import { CloudinaryMediaProvider } from './providers/media/cloudinary.provider.js';
import { UnavailableMediaProvider } from './providers/media/unavailable.provider.js';
import { discoveryRoutes } from './modules/discovery/discovery.routes.js';
import { discoveryService } from './modules/discovery/discovery.service.js';
import { matchingService } from './modules/matching/matching.service.js';
import { jobRoutes } from './modules/jobRequests/job.routes.js';
import { jobService } from './modules/jobRequests/job.service.js';
import { quoteRoutes } from './modules/quotes/quote.routes.js';
import { quoteService } from './modules/quotes/quote.service.js';
export function createApp(config, options = {}) {
  const app = express();
  app.set('env', config.NODE_ENV);
  app.disable('x-powered-by');
  if (config.TRUST_PROXY_HOPS > 0)
    app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === config.FRONTEND_ORIGIN)
          return callback(null, true);
        callback(
          new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'),
        );
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Retry-After', 'RateLimit', 'RateLimit-Policy', 'X-SkillLink-Rate-Limit'],
    }),
  );
  if (config.NODE_ENV === 'development')
    app.use(
      morgan(':method :url :status :response-time ms', {
        skip: (req) => req.url.includes('?'),
      }),
    );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: options.globalLimit ?? 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler(_req, res, _next, settings) {
        res.set('X-SkillLink-Rate-Limit', 'global');
        res.status(settings.statusCode).json(settings.message);
      },
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      },
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (_req, res) => success(res, { status: 'ok' }));
  app.get('/api/ready', (_req, res) => {
    if (mongoose.connection.readyState !== 1)
      return res
        .status(503)
        .json({
          success: false,
          error: { code: 'NOT_READY', message: 'Service is not ready' },
        });
    return success(res, { status: 'ready' });
  });
  const auth = authService(config);
  const protect = authenticate(auth);
  const provider =
    options.mediaProvider ??
    (config.MEDIA_PROVIDER === 'cloudinary'
      ? new CloudinaryMediaProvider(config)
      : new UnavailableMediaProvider());
  const media = mediaService(provider);
  const matching = matchingService(config.DISCOVERY_MAX_RADIUS_KM ?? 200);
  const notifications = notificationService(
    options.emailProvider ?? new DisabledEmailProvider(),
  );
  const effects = (service, names) => notifying(service, names, notifications);
  app.use('/api', notificationRoutes(protect, notifications));
  app.use('/api', operationsRoutes(protect, operationsService(), options));
  const quotes = effects(quoteService(matching, media), [
    'submit',
    'change',
    'accept',
  ]);
  app.use(
    '/api',
    lifecycleRoutes(
      protect,
      effects(lifecycleService(media), [
        'start',
        'complete',
        'confirm',
        'dispute',
        'resolve',
        'review',
        'moderate',
      ]),
      options,
    ),
  );
  const payments = effects(
    paymentService(
      config,
      options.paymentProvider ?? new MockPaymentProvider(),
    ),
    ['checkout'],
  );
  app.use('/api', paymentRoutes(protect, payments, options));
  const conversations = effects(conversationService(media), ['send']);
  app.locals.services = { auth, conversations };
  app.locals.publish = async () => {};
  app.use(
    '/api',
    conversationRoutes(
      protect,
      conversations,
      (...args) => app.locals.publish(...args),
      options,
    ),
  );
  app.use('/api', availabilityRoutes(protect, availabilityService()));
  app.use(
    '/api',
    bookingRoutes(
      protect,
      effects(bookingService(config, matching, media), [
        'fromQuote',
        'propose',
        'decide',
        'sendQuote',
        'acceptQuote',
        'cancel',
      ]),
      options,
    ),
  );
  app.use('/api', discoveryRoutes(discoveryService(media), config));
  app.use(
    '/api',
    jobRoutes(
      protect,
      effects(jobService(media, matching), ['cancel']),
      quotes,
      options,
    ),
  );
  app.use('/api', quoteRoutes(protect, quotes, options));
  app.use('/api/auth', authRoutes(auth, options));
  app.use('/api', catalogRoutes(protect));
  app.use('/api', workerRoutes(protect, workerService(media)));
  app.use('/api/media', mediaRoutes(protect, media, options));
  app.use(
    '/api',
    verificationRoutes(
      protect,
      effects(verificationService(media), ['review']),
    ),
  );
  app.use((_req, _res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'Route not found')),
  );
  app.use(errorHandler);
  return app;
}
