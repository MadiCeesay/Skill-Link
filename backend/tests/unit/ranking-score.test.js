import { describe, it, expect } from 'vitest';
import {
  RANKING_WEIGHTS, scoreWorker, compareRanked, distanceFactor, ratingFactor, bayesianRating,
  trustFactor, responsivenessFactor, experienceFactor, availabilityFactor,
} from '../../src/modules/ranking/ranking.score.js';

const base = {
  distanceKm: null, approximateDistanceKm: undefined, averageRating: 0, reviewCount: 0, completedJobs: 0,
  identityVerified: false, workEvidenceReviewed: false, availableNow: false,
  responses: { received: 0, responded: 0, averageMinutes: null },
};
const worker = extra => ({ ...base, ...extra, responses: { ...base.responses, ...extra?.responses } });

describe('worker ranking factors', () => {
  it('uses weights that add up to exactly 1', () => {
    expect(Object.values(RANKING_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
  it('prefers closer workers and stays neutral without a location', () => {
    expect(distanceFactor(0)).toBe(1);
    expect(distanceFactor(5)).toBeCloseTo(0.5);
    expect(distanceFactor(2)).toBeGreaterThan(distanceFactor(20));
    expect(distanceFactor(null)).toBe(0.5);
  });
  it('stops one lucky review outranking a long record (Bayesian average)', () => {
    expect(bayesianRating(0, 0)).toBe(3.5);
    expect(ratingFactor(5, 1)).toBeLessThan(ratingFactor(4.8, 40));
    expect(ratingFactor(5, 1)).toBeGreaterThan(ratingFactor(0, 0));
    expect(ratingFactor(1, 50)).toBeLessThan(ratingFactor(0, 0));
  });
  it('gives most trust weight to identity approval', () => {
    expect(trustFactor({})).toBe(0);
    expect(trustFactor({ identityVerified: true })).toBeCloseTo(0.6);
    expect(trustFactor({ identityVerified: true, workEvidenceReviewed: true })).toBeCloseTo(1);
  });
  it('does not punish new workers for missing response history', () => {
    expect(responsivenessFactor({ received: 1, responded: 1, averageMinutes: 5 })).toBe(0.5);
    const fast = responsivenessFactor({ received: 5, responded: 5, averageMinutes: 10 });
    const slow = responsivenessFactor({ received: 5, responded: 5, averageMinutes: 2 * 24 * 60 });
    const ignores = responsivenessFactor({ received: 10, responded: 4, averageMinutes: 10 });
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeGreaterThan(ignores);
  });
  it('gives diminishing returns for experience', () => {
    expect(experienceFactor(0)).toBe(0);
    expect(experienceFactor(20)).toBeCloseTo(1);
    expect(experienceFactor(200)).toBe(1);
    expect(experienceFactor(5) - experienceFactor(0)).toBeGreaterThan(experienceFactor(20) - experienceFactor(15));
  });
  it('rewards availability without zeroing busy workers', () => {
    expect(availabilityFactor(true)).toBe(1);
    expect(availabilityFactor(false)).toBeGreaterThan(0);
  });
});

describe('scoreWorker', () => {
  it('returns a score between 0 and 100 with the factor breakdown', () => {
    const best = scoreWorker(worker({ distanceKm: 0, averageRating: 5, reviewCount: 200, completedJobs: 50,
      identityVerified: true, workEvidenceReviewed: true, availableNow: true,
      responses: { received: 20, responded: 20, averageMinutes: 0 } }));
    const worst = scoreWorker(worker({ distanceKm: 1000, averageRating: 1, reviewCount: 200,
      responses: { received: 20, responded: 3, averageMinutes: 10000 } }));
    expect(best.score).toBeLessThanOrEqual(100);
    expect(best.score).toBeGreaterThan(90);
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThan(25);
    expect(Object.keys(best.factors).sort()).toEqual(Object.keys(RANKING_WEIGHTS).sort());
  });
  it('ranks a nearby verified worker above a distant unverified one', () => {
    const near = scoreWorker(worker({ distanceKm: 2, identityVerified: true }));
    const far = scoreWorker(worker({ distanceKm: 40 }));
    expect(near.score).toBeGreaterThan(far.score);
  });
  it('explains the result with at most three plain reasons', () => {
    const r = scoreWorker(worker({ distanceKm: 3.2, approximateDistanceKm: 5, averageRating: 4.8, reviewCount: 12,
      completedJobs: 12, identityVerified: true, availableNow: true, responses: { received: 6, responded: 6, averageMinutes: 20 } }));
    expect(r.reasons.map(x => x.code)).toEqual(['NEARBY', 'HIGHLY_RATED', 'FAST_REPLIES']);
    expect(r.reasons[0].text).toBe('Within about 5 km');
    expect(r.reasons[1].text).toBe('Rated 4.8 from 12 reviews');
  });
  it('never puts the exact distance into the reasons', () => {
    const r = scoreWorker(worker({ distanceKm: 3.217, approximateDistanceKm: 5 }));
    expect(JSON.stringify(r.reasons)).not.toContain('3.2');
  });
  it('describes brand-new workers honestly', () => {
    expect(scoreWorker(worker({})).reasons).toEqual([{ code: 'NEW', text: 'New on SkillLink' }]);
  });
  it('sorts by score and breaks ties by id so pages are stable', () => {
    const rows = [{ id: 'b', ranking: { score: 50 } }, { id: 'a', ranking: { score: 50 } }, { id: 'c', ranking: { score: 70 } }];
    expect(rows.sort(compareRanked).map(r => r.id)).toEqual(['c', 'a', 'b']);
  });
});
