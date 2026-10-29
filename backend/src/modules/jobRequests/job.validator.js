import { z } from 'zod';
import { objectId, text, uniqueIds } from '../../utils/validation.js';
import { pointSchema } from '../workers/worker.validator.js';
export const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const instant = z.iso.datetime({ offset: true }).transform(v => new Date(v));
export const budgetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('FIXED'), amountBututs: money, currency: z.literal('GMD').default('GMD') }).strict(),
  z.object({ type: z.literal('RANGE'), minAmountBututs: money, maxAmountBututs: money, currency: z.literal('GMD').default('GMD') }).strict().refine(v => v.minAmountBututs <= v.maxAmountBututs, 'Budget minimum cannot exceed maximum'),
  z.object({ type: z.literal('OPEN_TO_QUOTES'), currency: z.literal('GMD').default('GMD') }).strict(),
]);
export const jobWrite = z.object({
  service: objectId, title: text(120).min(5), description: text(3000).min(20),
  serviceArea: z.object({ name: text(100), region: text(100).optional(), country: z.literal('GM').default('GM') }).strict(),
  location: pointSchema.nullable().optional(), privateAddress: z.string().trim().max(500).optional(),
  preferredDate: z.iso.date().optional(), preferredTimeNote: z.string().trim().max(200).optional(),
  budget: budgetSchema.optional(), attachments: uniqueIds.refine(v => v.length <= 5, 'Maximum five attachments').optional(), expiresAt: instant.optional(),
}).strict();
export const jobUpdate = jobWrite.partial().refine(v => Object.keys(v).length > 0, 'Provide fields to update');
export const jobListQuery = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20), status: z.enum(['OPEN', 'QUOTE_ACCEPTED', 'CANCELLED', 'EXPIRED']).optional() }).strict();
export const marketPagination = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict();
