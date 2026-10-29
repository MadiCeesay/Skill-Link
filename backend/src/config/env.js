import 'dotenv/config';
import { z } from 'zod';
const optionalCredential = z.preprocess(v => v === '' ? undefined : v, z.string().min(1).max(256).optional());
const duration = z.string().regex(/^[1-9]\d*(s|m|h|d)$/);
export function seconds(value) {
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(value.slice(0, -1)) * units[value.at(-1)];
}
export function loadConfig(input = process.env) {
  const schema = z.object({
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    EMAIL_PROVIDER: z.literal('disabled').default('disabled'),
    COMMISSION_BASIS_POINTS: z.coerce.number().int().min(0).max(10000).default(1000),
    PAYMENT_PROVIDER: z.literal('mock').default('mock'),
    BOOKING_RESERVATION_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    DISCOVERY_DEFAULT_RADIUS_KM: z.coerce.number().int().min(1).max(500).default(25),
    DISCOVERY_MAX_RADIUS_KM: z.coerce.number().int().min(1).max(500).default(200),
    MEDIA_PROVIDER: z.enum(['disabled', 'cloudinary']).default('disabled'),
    CLOUDINARY_CLOUD_NAME: optionalCredential,
    CLOUDINARY_API_KEY: optionalCredential,
    CLOUDINARY_API_SECRET: optionalCredential,
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: duration.default('15m'),
    JWT_REFRESH_EXPIRES_IN: duration.default('7d'),
    FRONTEND_ORIGIN: z.string().refine(v => {
      try { const url = new URL(v); return ['http:', 'https:'].includes(url.protocol) && url.origin === v; }
      catch { return false; }
    }, 'Use an exact HTTP(S) origin without a path or trailing slash'),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid environment configuration: ' + [...new Set(parsed.error.issues.map(i => i.path.join('.')))].join(', '));
  const c = parsed.data;
  if (c.JWT_ACCESS_SECRET === c.JWT_REFRESH_SECRET) throw new Error('JWT secrets must be different');
  if (seconds(c.JWT_ACCESS_EXPIRES_IN) > 3600 || seconds(c.JWT_REFRESH_EXPIRES_IN) > 30 * 86400 || seconds(c.JWT_REFRESH_EXPIRES_IN) <= seconds(c.JWT_ACCESS_EXPIRES_IN)) {
    throw new Error('Access lifetime must be <= 1h; refresh lifetime must exceed access lifetime and be <= 30d');
  }
  if (c.NODE_ENV === 'production' && !c.FRONTEND_ORIGIN.startsWith('https://')) throw new Error('Production frontend origin must use HTTPS');
  const mediaCredentials = [c.CLOUDINARY_CLOUD_NAME, c.CLOUDINARY_API_KEY, c.CLOUDINARY_API_SECRET].filter(Boolean).length;
  if ((mediaCredentials > 0 && mediaCredentials !== 3) || (c.MEDIA_PROVIDER === 'cloudinary' && mediaCredentials !== 3)) throw new Error('Invalid environment configuration: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  if (c.DISCOVERY_DEFAULT_RADIUS_KM > c.DISCOVERY_MAX_RADIUS_KM) throw new Error('Invalid environment configuration: DISCOVERY_DEFAULT_RADIUS_KM, DISCOVERY_MAX_RADIUS_KM');
  return Object.freeze(c);
}
