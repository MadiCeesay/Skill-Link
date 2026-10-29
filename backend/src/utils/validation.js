import { z } from 'zod';
import { ApiError } from './ApiError.js';
export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Use a valid resource ID').transform(v => v.toLowerCase());
export const text = (max = 100) => z.string().trim().min(1).max(max);
export const uniqueIds = z.array(objectId).max(20).refine(v => new Set(v).size === v.length, 'Duplicate IDs are not allowed');
export const pagination = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
export const idParams = key => z.object({ [key]: objectId }).strict();
export const validatePart = (schema, source, target) => (req, _res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) return next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))));
  req[target] = parsed.data;
  next();
};
export const params = schema => validatePart(schema, 'params', 'validatedParams');
export const query = schema => validatePart(schema, 'query', 'validatedQuery');
