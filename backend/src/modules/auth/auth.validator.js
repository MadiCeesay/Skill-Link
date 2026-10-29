import { z } from 'zod';
const email = z.string().trim().toLowerCase().max(254).email();
const password = z.string().min(8).max(72)
  .refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must not exceed 72 UTF-8 bytes')
  .regex(/[a-z]/, 'Include a lowercase letter').regex(/[A-Z]/, 'Include an uppercase letter').regex(/[0-9]/, 'Include a number');
const phone = z.string().trim().transform(v => v.replace(/[ ()-]/g, ''))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, for example +220 followed by seven digits'));
export const registrationSchema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  email, phoneNumber: phone, password,
}).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must not exceed 72 UTF-8 bytes') }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(4096) }).strict();
export const emptyBodySchema = z.object({}).strict().default({});
