import { verificationSummary } from '../workers/worker.serializer.js';
export function verificationDTO(doc, admin = false) {
  if (!doc) return { status: 'NOT_SUBMITTED', verificationSummary: verificationSummary(null) };
  return { id: doc.id, worker: String(doc.worker), identityDocument: String(doc.identityDocument), skillCertificates: doc.skillCertificates.map(String),
    workEvidence: doc.workEvidence.map(String), reference: doc.reference ? { name: doc.reference.name, relationship: doc.reference.relationship, contact: doc.reference.contact } : null,
    status: doc.status, submittedAt: doc.submittedAt, reviewedAt: doc.reviewedAt,
    rejectionReason: doc.status === 'REJECTED' ? doc.rejectionReason : null, verificationSummary: verificationSummary(doc),
    ...(admin ? { reviewedBy: doc.reviewedBy ? String(doc.reviewedBy) : null, adminNotes: doc.adminNotes || '' } : {}) };
}
