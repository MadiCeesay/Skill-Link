import { z } from 'zod';
import { objectId, text } from '../../utils/validation.js';
const name = text(100).transform(v => v.replace(/\s+/g, ' '));
const slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const shared = { name, slug: slug.optional(), description: z.string().trim().max(1000).optional(), isActive: z.boolean().optional() };
export const categoryCreate = z.object({ ...shared, icon: text(80).nullable().optional(), sortOrder: z.number().int().min(0).max(10000).optional() }).strict();
export const categoryUpdate = categoryCreate.partial().refine(v => Object.keys(v).length > 0, 'Provide a field to update');
export const serviceCreate = z.object({ ...shared, category: objectId }).strict();
export const serviceUpdate = serviceCreate.omit({ category: true }).partial().refine(v => Object.keys(v).length > 0, 'Provide a field to update');
