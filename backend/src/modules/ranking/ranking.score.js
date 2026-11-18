// Worker ranking: a transparent, weighted score used for "Recommended" search results.
//
// Every factor is turned into a number between 0 and 1, multiplied by its weight,
// and the weighted factors are added up to give a score between 0 and 100.
// The same numbers are used to explain the result to the customer, so the
// ranking is never a black box. See backend/docs/worker-ranking.md.

// How much each factor counts. The weights add up to 1.
export const RANKING_WEIGHTS = Object.freeze({
  distance: 0.3,
  rating: 0.2,
  trust: 0.15,
  responsiveness: 0.15,
  experience: 0.1,
  availability: 0.1,
});

// A new worker is treated as if they already had a few average reviews, so one
// lucky 5-star review cannot push them above an established worker, and a new
// worker with no reviews is not buried at the bottom (Bayesian average).
export const RATING_PRIOR = Object.freeze({ average: 3.5, weight: 3 });

// Neutral value used when we have no information about a factor.
const NEUTRAL = 0.5;
// Response statistics are only trusted once a worker has answered this many requests.
const MIN_RESPONSES_FOR_SPEED = 3;
// Completed jobs at which the experience factor reaches its maximum.
const EXPERIENCED_JOBS = 20;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// Closer is better. 0 km gives 1, 5 km gives 0.5, 15 km gives 0.25.
export function distanceFactor(distanceKm) {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm)) return NEUTRAL;
  return 1 / (1 + Math.max(0, distanceKm) / 5);
}

// Bayesian average of the star rating, mapped from 1–5 stars onto 0–1.
export function bayesianRating(averageRating = 0, reviewCount = 0) {
  const reviews = Math.max(0, reviewCount || 0);
  const total = (averageRating || 0) * reviews;
  return (RATING_PRIOR.average * RATING_PRIOR.weight + total) / (RATING_PRIOR.weight + reviews);
}
export function ratingFactor(averageRating, reviewCount) {
  return clamp((bayesianRating(averageRating, reviewCount) - 1) / 4);
}

// Identity approval counts most; reviewed work evidence adds the rest.
export function trustFactor({ identityVerified = false, workEvidenceReviewed = false } = {}) {
  return (identityVerified ? 0.6 : 0) + (workEvidenceReviewed ? 0.4 : 0);
}

// Combines how often a worker answers requests with how quickly they answer.
// Workers with too little history get the neutral value instead of a penalty.
export function responsivenessFactor({ received = 0, responded = 0, averageMinutes = null } = {}) {
  if (responded < MIN_RESPONSES_FOR_SPEED || !received) return NEUTRAL;
  const answerRate = clamp(responded / received);
  // Answering within an hour gives at least 0.5 speed; answering after a day gives very little.
  const speed = averageMinutes === null ? NEUTRAL : 1 / (1 + Math.max(0, averageMinutes) / 60);
  return clamp(answerRate * (0.5 + 0.5 * speed));
}

// Diminishing returns: the first jobs matter more than the twentieth.
export function experienceFactor(completedJobs = 0) {
  return clamp(Math.log1p(Math.max(0, completedJobs)) / Math.log1p(EXPERIENCED_JOBS));
}

export function availabilityFactor(availableNow = false) {
  return availableNow ? 1 : 0.3;
}

// Human-readable reasons, strongest first. Only facts the customer can already
// see on the public profile are used; distance is the coarse public band.
function reasonsFor(features, factors) {
  const reasons = [];
  if (features.approximateDistanceKm && features.approximateDistanceKm <= 10)
    reasons.push({ code: 'NEARBY', text: `Within about ${features.approximateDistanceKm} km` });
  if (features.reviewCount > 0 && features.averageRating >= 4)
    reasons.push({ code: 'HIGHLY_RATED', text: `Rated ${features.averageRating.toFixed(1)} from ${features.reviewCount} review${features.reviewCount === 1 ? '' : 's'}` });
  const responses = features.responses || {};
  if (responses.responded >= MIN_RESPONSES_FOR_SPEED && responses.averageMinutes !== null && factors.responsiveness >= 0.5) {
    if (responses.averageMinutes <= 60) reasons.push({ code: 'FAST_REPLIES', text: 'Usually replies within an hour' });
    else if (responses.averageMinutes <= 24 * 60) reasons.push({ code: 'REPLIES_SAME_DAY', text: 'Usually replies within a day' });
  }
  if (features.completedJobs > 0)
    reasons.push({ code: 'EXPERIENCED', text: `${features.completedJobs} job${features.completedJobs === 1 ? '' : 's'} completed on SkillLink` });
  if (features.identityVerified) reasons.push({ code: 'VERIFIED', text: 'Identity verified' });
  if (features.availableNow) reasons.push({ code: 'AVAILABLE_NOW', text: 'Available now' });
  if (!reasons.length) reasons.push({ code: 'NEW', text: 'New on SkillLink' });
  return reasons.slice(0, 3);
}

/**
 * Scores one worker.
 * @param {object} features
 * @param {number|null} features.distanceKm exact distance (used only for scoring, never returned)
 * @param {number|undefined} features.approximateDistanceKm public 5 km distance band
 * @param {number} features.averageRating
 * @param {number} features.reviewCount
 * @param {number} features.completedJobs
 * @param {boolean} features.identityVerified
 * @param {boolean} features.workEvidenceReviewed
 * @param {boolean} features.availableNow
 * @param {{received:number, responded:number, averageMinutes:number|null}} features.responses
 * @returns {{score:number, factors:object, reasons:{code:string,text:string}[]}}
 */
export function scoreWorker(features, weights = RANKING_WEIGHTS) {
  const factors = {
    distance: distanceFactor(features.distanceKm),
    rating: ratingFactor(features.averageRating, features.reviewCount),
    trust: trustFactor(features),
    responsiveness: responsivenessFactor(features.responses),
    experience: experienceFactor(features.completedJobs),
    availability: availabilityFactor(features.availableNow),
  };
  const weighted = Object.entries(weights).reduce((sum, [name, weight]) => sum + weight * factors[name], 0);
  return { score: Math.round(weighted * 1000) / 10, factors, reasons: reasonsFor(features, factors) };
}

// Highest score first; ties are broken by a stable id so pages never shuffle.
export function compareRanked(a, b) {
  return b.ranking.score - a.ranking.score || String(a.id).localeCompare(String(b.id));
}
