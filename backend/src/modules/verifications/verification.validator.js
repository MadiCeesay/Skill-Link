import { z } from 'zod';
import { objectId, uniqueIds, text } from '../../utils/validation.js';
export const verificationSubmit = z.object({
  identityDocument: objectId,
  skillCertificates: uniqueIds.default([]).refine(v => v.length <= 5, 'Maximum five certificates'),
  workEvidence: uniqueIds.default([]).refine(v => v.length <= 10, 'Maximum ten work-evidence files'),
  reference: z.object({ name: text(100), relationship: text(100), contact: text(200) }).strict().optional(),
}).strict();
export const verificationDecision = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']), adminNotes: z.string().trim().max(2000).optional(),
  rejectionReason: z.string().trim().min(10).max(1000).optional(), workEvidenceReviewed: z.boolean().default(false),
}).strict().superRefine((v, ctx) => {
  if (v.decision === 'REJECTED' && !v.rejectionReason) ctx.addIssue({ code: 'custom', path: ['rejectionReason'], message: 'A rejection reason of at least ten characters is required' });
  if (v.decision === 'APPROVED' && v.rejectionReason) ctx.addIssue({ code: 'custom', path: ['rejectionReason'], message: 'Approved submissions cannot have rejection reasons' });
  if (v.decision === 'REJECTED' && v.workEvidenceReviewed) ctx.addIssue({ code: 'custom', path: ['workEvidenceReviewed'], message: 'Rejected submissions cannot grant badges' });
});
