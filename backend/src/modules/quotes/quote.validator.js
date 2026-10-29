import { z } from 'zod';
import { money, instant } from '../jobRequests/job.validator.js';
export const quoteWrite = z.object({
  proposedAmountBututs: money, currency: z.literal('GMD').optional(), message: z.string().trim().max(1500).optional(),
  estimatedDurationMinutes: z.number().int().min(15).max(43200).optional(),
  proposedSchedule: z.object({ date: z.iso.date(), note: z.string().trim().max(300).optional() }).strict().optional(), expiresAt: instant.optional(),
}).strict();
export const quoteUpdate = quoteWrite.partial().refine(v => Object.keys(v).length > 0, 'Provide fields to update');
