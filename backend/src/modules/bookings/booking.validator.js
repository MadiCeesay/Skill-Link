import { z } from 'zod';
import { objectId, text, uniqueIds } from '../../utils/validation.js';
import { schedule } from '../availability/availability.validator.js';
import { money } from '../jobRequests/job.validator.js';
import { pointSchema } from '../workers/worker.validator.js';
export const proposalWrite = z
  .object({
    worker: objectId,
    service: objectId,
    description: text(3000).min(20),
    serviceArea: z
      .object({
        name: text(100),
        region: text(100).optional(),
        country: z.literal('GM').default('GM'),
      })
      .strict(),
    location: pointSchema.optional(),
    privateAddress: text(500).optional(),
    scheduledStart: schedule.shape.scheduledStart,
    scheduledEnd: schedule.shape.scheduledEnd,
    agreedAmountBututs: money.optional(),
    pricingMode: z.enum(['REQUEST_QUOTE', 'LISTED_PRICE']).optional(),
    listedAmountBututs: money.min(1).optional(),
    budget: z.object({ minAmountBututs: money.min(1), maxAmountBututs: money.min(1) }).strict()
      .refine(v => v.maxAmountBututs >= v.minAmountBututs, 'Budget maximum must cover minimum').optional(),
    attachments: uniqueIds.refine(v => v.length <= 5, 'Maximum five photos').optional(),
  })
  .strict()
  .refine(v => v.pricingMode ? v.agreedAmountBututs === undefined : v.agreedAmountBututs !== undefined,
    'Use pricing options or a legacy proposed amount, not both')
  .refine(v => !v.budget || v.pricingMode === 'REQUEST_QUOTE', 'Budget is only a guide for a quote request')
  .refine(v => v.pricingMode === 'LISTED_PRICE' ? v.listedAmountBututs !== undefined : v.listedAmountBututs === undefined,
    'Confirm the displayed fixed price')
  .refine(
    (v) =>
      schedule.safeParse({
        scheduledStart: v.scheduledStart.toISOString(),
        scheduledEnd: v.scheduledEnd.toISOString(),
      }).success,
    'Invalid proposed schedule',
  );
export const bookingFromQuote = z
  .object({
    quote: objectId,
    scheduledStart: schedule.shape.scheduledStart,
    scheduledEnd: schedule.shape.scheduledEnd,
  })
  .strict()
  .refine(
    (v) =>
      schedule.safeParse({
        scheduledStart: v.scheduledStart.toISOString(),
        scheduledEnd: v.scheduledEnd.toISOString(),
      }).success,
    'Invalid booking schedule',
  );
export const cancelBooking = z.object({ reason: text(500) }).strict();
export const directQuoteWrite = z.object({
  amountBututs: money.min(1),
  note: z.string().trim().max(2000).default(''),
  revision: z.number().int().min(0).max(100),
  expiresAt: z.iso.datetime({ offset: true }).transform(v => new Date(v)).optional(),
}).strict();
export const directQuoteAccept = z.object({ revision: z.number().int().min(1).max(100) }).strict();
