import { z } from 'zod';
import { objectId, text, uniqueIds } from '../../utils/validation.js';
export const pointSchema = z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }).strict();
const pricing = z.object({ service: objectId, type: z.enum(['FIXED', 'HOURLY', 'STARTING_FROM', 'QUOTE_REQUIRED']), amountBututs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(), currency: z.literal('GMD').default('GMD') }).strict().superRefine((v, ctx) => {
  if ((v.type === 'QUOTE_REQUIRED') !== (v.amountBututs === undefined)) ctx.addIssue({ code: 'custom', path: ['amountBututs'], message: 'Quote required has no amount; other pricing types require integer bututs' });
});
export const profileUpdate = z.object({
  professionTitle: z.string().trim().max(120).optional(), bio: z.string().trim().max(2000).optional(),
  yearsOfExperience: z.number().int().min(0).max(80).optional(),
  skills: z.array(text(100)).max(30).refine(v => new Set(v.map(s => s.toLowerCase())).size === v.length, 'Duplicate skills are not allowed').optional(),
  services: uniqueIds.optional(),
  serviceAreas: z.array(z.object({ name: text(100), region: text(100).optional(), country: z.literal('GM').default('GM') }).strict()).max(30).optional(),
  primaryLocation: pointSchema.nullable().optional(), serviceRadiusKm: z.number().min(1).max(2000).optional(),
  pricing: z.array(pricing).max(20).refine(v => new Set(v.map(p => p.service)).size === v.length, 'One pricing entry per service').optional(),
  profileImage: objectId.nullable().optional(), availableNow: z.boolean().optional(), profileVisibility: z.enum(['DRAFT', 'PUBLIC']).optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Provide professional profile fields');
export const profileCreate = profileUpdate;
export const portfolioCreate = z.object({ media: objectId, title: text(120), description: z.string().trim().max(1000).optional(), service: objectId.optional() }).strict();
export const portfolioUpdate = portfolioCreate.omit({ media: true }).partial().refine(v => Object.keys(v).length > 0, 'Provide portfolio metadata');
