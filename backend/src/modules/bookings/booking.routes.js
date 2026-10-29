import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { bookingController } from './booking.controller.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { params, idParams, query, objectId } from '../../utils/validation.js';
import { marketPagination } from '../jobRequests/job.validator.js';
import { emptyBodySchema } from '../auth/auth.validator.js';
import {
  proposalWrite,
  bookingFromQuote,
  cancelBooking,
  directQuoteWrite,
  directQuoteAccept,
} from './booking.validator.js';
export function bookingRoutes(protect, service, options = {}) {
  const r = Router(),
    c = bookingController(service);
  const limit = rateLimit({
    windowMs: 900000,
    limit: options.marketWriteLimit ?? 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many booking actions' },
    },
  });
  r.use(['/bookings', '/direct-proposals'], protect, (_q, s, n) => {
    s.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    n();
  });
  r.post(
    '/bookings/from-quote',
    authorize('CUSTOMER'),
    limit,
    validate(bookingFromQuote),
    c.fromQuote,
  );
  r.get(
    '/bookings/me',
    authorize('CUSTOMER', 'WORKER'),
    query(marketPagination),
    c.list,
  );
  r.get(
    '/bookings/:id',
    authorize('CUSTOMER', 'WORKER'),
    params(idParams('id')),
    c.own,
  );
  r.post(
    '/bookings/:id/cancel',
    authorize('CUSTOMER', 'WORKER'),
    params(idParams('id')),
    limit,
    validate(cancelBooking),
    c.cancel,
  );
  r.post(
    '/direct-proposals',
    authorize('CUSTOMER'),
    limit,
    validate(proposalWrite),
    c.propose,
  );
  r.get(
    '/direct-proposals/me',
    authorize('CUSTOMER', 'WORKER'),
    query(marketPagination),
    c.proposals,
  );
  r.get(
    '/direct-proposals/:id',
    authorize('CUSTOMER', 'WORKER'),
    params(idParams('id')),
    c.proposal,
  );
  for (const [path, role, status] of [
    ['accept', 'WORKER', 'ACCEPTED'],
    ['reject', 'WORKER', 'REJECTED'],
    ['cancel', 'CUSTOMER', 'CANCELLED'],
    ['decline-quote', 'CUSTOMER', 'QUOTE_DECLINED'],
  ])
    r.post(
      '/direct-proposals/:id/' + path,
      authorize(role),
      params(idParams('id')),
      limit,
      validate(emptyBodySchema),
      c.decide(status),
    );
  r.post('/direct-proposals/:id/quote', authorize('WORKER'), params(idParams('id')), limit, validate(directQuoteWrite), c.sendQuote);
  r.post('/direct-proposals/:id/accept-quote', authorize('CUSTOMER'), params(idParams('id')), limit, validate(directQuoteAccept), c.acceptQuote);
  r.get('/direct-proposals/:id/attachments/:mediaId/access', authorize('CUSTOMER', 'WORKER'),
    params(z.object({ id: objectId, mediaId: objectId }).strict()), c.attachment);
  return r;
}
