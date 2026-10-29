import { z } from 'zod';
import { objectId, text } from '../../utils/validation.js';
const boolean = z.enum(['true', 'false']).transform(v => v === 'true');
export function discoveryQuery(maxRadius = 200, defaultRadius = 25) {
  return z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
    service: objectId.optional(), category: objectId.optional(), area: text(100).optional(), q: text(80).optional(),
    verified: boolean.optional(), availableNow: boolean.optional(), minRating: z.coerce.number().min(0).max(5).optional(),
    pricingType: z.enum(['FIXED', 'HOURLY', 'STARTING_FROM', 'QUOTE_REQUIRED']).optional(),
    longitude: z.preprocess(v => v === '' ? NaN : v, z.coerce.number().min(-180).max(180)).optional(), latitude: z.preprocess(v => v === '' ? NaN : v, z.coerce.number().min(-90).max(90)).optional(),
    radiusKm: z.coerce.number().int().min(1).max(maxRadius).optional(),
    sort: z.enum(['relevance', 'distance', 'trust', 'rating', 'price']).default('relevance'),
  }).strict().superRefine((v, ctx) => {
    const hasPoint = v.longitude !== undefined && v.latitude !== undefined;
    if ((v.longitude !== undefined) !== (v.latitude !== undefined) || (v.radiusKm !== undefined && !hasPoint) || (v.sort === 'distance' && !hasPoint)) ctx.addIssue({ code: 'custom', message: 'Longitude and latitude must be supplied together for radius/distance searches' });
    if (v.sort === 'price' && (!v.service || !v.pricingType || v.pricingType === 'QUOTE_REQUIRED')) ctx.addIssue({ code: 'custom', message: 'Price sorting requires one service and a comparable numeric pricing type' });
  }).transform(v => ({ ...v, ...(v.longitude === undefined ? {} : { radiusKm: v.radiusKm ?? defaultRadius }) }));
}
