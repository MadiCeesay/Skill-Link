export const disputeDTO = (d, admin = false) => ({
  id: String(d._id),
  booking: String(d.booking),
  customer: String(d.customer),
  worker: String(d.worker),
  reason: d.reason,
  description: d.description,
  evidence: d.evidence.map(String),
  status: d.status,
  adminDecision: d.adminDecision,
  decisionReason: d.decisionReason,
  ...(admin
    ? { reviewedBy: d.reviewedBy ? String(d.reviewedBy) : undefined }
    : {}),
  reviewedAt: d.reviewedAt,
  createdAt: d.createdAt,
});
export const reviewDTO = (r) => ({
  id: String(r._id),
  booking: String(r.booking),
  worker: String(r.worker),
  rating: r.rating,
  comment: r.comment,
  moderationStatus: r.moderationStatus,
  createdAt: r.createdAt,
});
