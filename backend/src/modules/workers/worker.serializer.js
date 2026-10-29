export function verificationSummary(verification) {
  const approved = verification?.status === 'APPROVED';
  const identityVerified = approved;
  const workEvidenceReviewed = approved && verification.workEvidenceReviewed && verification.workEvidence.length > 0;
  const verifiedWorker = identityVerified && Boolean(workEvidenceReviewed);
  return { status: verification?.status || 'NOT_SUBMITTED', identityVerified, workEvidenceReviewed: Boolean(workEvidenceReviewed), verifiedWorker,
    badges: [...(identityVerified ? ['Identity Verified'] : []), ...(workEvidenceReviewed ? ['Work Evidence Reviewed'] : []), ...(verifiedWorker ? ['Verified Worker'] : [])] };
}
export function profileCompletion(profile, verification) {
  const parts = [profile.professionTitle.trim().length > 0, profile.bio.trim().length >= 20, profile.services.length > 0, profile.serviceAreas.length > 0,
    Boolean(profile.primaryLocation), profile.portfolio.length > 0, profile.pricing.length > 0, Boolean(verification)];
  return Math.round(parts.filter(Boolean).length / parts.length * 100);
}
export function ownProfile(profile, verification) {
  return { id: profile.id, user: String(profile.user), professionTitle: profile.professionTitle, bio: profile.bio, yearsOfExperience: profile.yearsOfExperience,
    skills: profile.skills, services: profile.services.map(String), serviceAreas: profile.serviceAreas.map(a => ({ name: a.name, region: a.region, country: a.country })),
    primaryLocation: profile.primaryLocation ? { type: 'Point', coordinates: [...profile.primaryLocation.coordinates] } : null,
    serviceRadiusKm: profile.serviceRadiusKm, profileImage: profile.profileImage ? String(profile.profileImage) : null,
    portfolio: profile.portfolio.map(p => ({ id: p.id, media: String(p.media), title: p.title, description: p.description, service: p.service ? String(p.service) : null, createdAt: p.createdAt, updatedAt: p.updatedAt })),
    pricing: profile.pricing.map(p => ({ service: String(p.service), type: p.type, ...(p.amountBututs === undefined ? {} : { amountBututs: p.amountBututs }), currency: p.currency })),
    verificationSummary: verificationSummary(verification), profileCompletion: profileCompletion(profile, verification), profileVisibility: profile.profileVisibility,
    averageRating: profile.averageRating, reviewCount: profile.reviewCount, completedJobsCount: profile.completedJobsCount, availableNow: profile.availableNow,
    createdAt: profile.createdAt, updatedAt: profile.updatedAt };
}
