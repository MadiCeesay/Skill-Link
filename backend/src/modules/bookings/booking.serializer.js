export const bookingStatus = (b) =>
  b.status === 'AWAITING_PAYMENT' && b.reservationExpiresAt <= new Date()
    ? 'CANCELLED'
    : b.status;
export function bookingDTO(b, user) {
  const precise =
    String(b.customer) === String(user._id) ||
    [
      'CONFIRMED',
      'IN_PROGRESS',
      'WORKER_MARKED_COMPLETED',
      'COMPLETED',
      'DISPUTED',
    ].includes(b.status) ||
    user.role === 'ADMIN';
  return {
    id: String(b._id),
    customer: String(b.customer),
    worker: String(b.worker),
    service: String(b.service),
    jobRequest: b.jobRequest ? String(b.jobRequest) : undefined,
    acceptedQuote: b.acceptedQuote ? String(b.acceptedQuote) : undefined,
    directProposal: b.directProposal ? String(b.directProposal) : undefined,
    scheduledStart: b.scheduledStart,
    scheduledEnd: b.scheduledEnd,
    serviceArea: b.serviceArea
      ? {
          name: b.serviceArea.name,
          region: b.serviceArea.region,
          country: b.serviceArea.country,
        }
      : undefined,
    ...(precise
      ? {
          location: b.location?.type
            ? { type: b.location.type, coordinates: b.location.coordinates }
            : undefined,
          privateAddress: b.privateAddress,
        }
      : {}),
    description: b.description,
    agreedAmountBututs: b.agreedAmountBututs,
    currency: b.currency,
    status: bookingStatus(b),
    reservationExpiresAt: b.reservationExpiresAt,
    payment: b.payment ? String(b.payment) : undefined,
    startedAt: b.startedAt,
    workerCompletedAt: b.workerCompletedAt,
    completedAt: b.completedAt,
    completionNotes: b.completionNotes,
    completionEvidence: b.completionEvidence?.map(String),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
export function proposalDTO(p, user) {
  return {
    id: String(p._id),
    customer: String(p.customer),
    worker: String(p.worker),
    service: String(p.service),
    description: p.description,
    serviceArea: p.serviceArea
      ? {
          name: p.serviceArea.name,
          region: p.serviceArea.region,
          country: p.serviceArea.country,
        }
      : undefined,
    ...(String(p.customer) === String(user._id)
      ? {
          location: p.location?.type
            ? { type: p.location.type, coordinates: p.location.coordinates }
            : undefined,
          privateAddress: p.privateAddress,
        }
      : {}),
    scheduledStart: p.scheduledStart,
    scheduledEnd: p.scheduledEnd,
    agreedAmountBututs: p.agreedAmountBututs,
    pricingMode: p.pricingMode,
    budget: p.budget?.minAmountBututs ? { minAmountBututs: p.budget.minAmountBututs, maxAmountBututs: p.budget.maxAmountBututs } : undefined,
    listedPrice: p.listedPrice ? { type: p.listedPrice.type, amountBututs: p.listedPrice.amountBututs } : undefined,
    attachments: p.attachments?.map(String),
    quoteRevision: p.quoteRevision || 0,
    quotes: p.quotes?.map(q => ({ revision: q.revision, amountBututs: q.amountBututs, note: q.note, expiresAt: q.expiresAt, createdAt: q.createdAt })),
    status:
      ['PENDING', 'QUOTED'].includes(p.status) && p.expiresAt <= new Date()
        ? 'EXPIRED'
        : p.status,
    expiresAt: p.expiresAt,
    booking: p.booking ? String(p.booking) : undefined,
    createdAt: p.createdAt,
  };
}
