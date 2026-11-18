import { z } from 'zod';
export const checkoutWrite = z
  .object({
    idempotencyKey: z
      .string()
      .min(8)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/),
    // Only the simulated provider takes an outcome; Modem Pay reports the real result.
    outcome: z.enum(['SUCCESS', 'FAILURE', 'PENDING']).optional(),
  })
  .strict();
