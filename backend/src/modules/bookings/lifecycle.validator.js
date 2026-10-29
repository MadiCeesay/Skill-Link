import { z } from 'zod';
import { text, uniqueIds } from '../../utils/validation.js';
export const completionWrite = z
  .object({
    notes: z.string().trim().max(2000).optional(),
    evidence: uniqueIds
      .refine((v) => v.length <= 5, 'At most five evidence images')
      .default([]),
  })
  .strict();
export const disputeWrite = z
  .object({
    reason: text(120),
    description: text(3000).min(20),
    evidence: uniqueIds
      .refine((v) => v.length <= 5, 'At most five evidence images')
      .default([]),
  })
  .strict();
export const disputeDecision = z
  .object({
    decision: z.enum(['RELEASE_TO_WORKER', 'REFUND_CUSTOMER']),
    reason: text(2000),
  })
  .strict();
export const reviewWrite = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).default(''),
  })
  .strict();
export const reviewModerate = z
  .object({ status: z.enum(['VISIBLE', 'HIDDEN']), reason: text(1000) })
  .strict();
