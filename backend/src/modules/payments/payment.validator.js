import { z } from 'zod';
export const checkoutWrite = z
  .object({
    idempotencyKey: z
      .string()
      .min(8)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/),
    outcome: z.enum(['SUCCESS', 'FAILURE', 'PENDING']),
  })
  .strict();
