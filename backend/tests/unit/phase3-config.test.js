import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { distanceKm } from '../../src/modules/matching/matching.service.js';
const base = { MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40), FRONTEND_ORIGIN: 'http://localhost:5173' };
describe('Phase 3 radius configuration and distance math', () => {
  it('provides bounded discovery radius defaults', () => { expect(loadConfig(base)).toMatchObject({ DISCOVERY_DEFAULT_RADIUS_KM: 25, DISCOVERY_MAX_RADIUS_KM: 200 }); });
  it('rejects a default radius exceeding the configured maximum', () => { expect(() => loadConfig({ ...base, DISCOVERY_DEFAULT_RADIUS_KM: 100, DISCOVERY_MAX_RADIUS_KM: 50 })).toThrow('DISCOVERY'); });
  it.each([0, -1, 501, 1.5])('rejects an invalid maximum radius %s', radius => { expect(() => loadConfig({ ...base, DISCOVERY_MAX_RADIUS_KM: radius })).toThrow('DISCOVERY_MAX_RADIUS_KM'); });
  it('returns zero distance for identical points and handles the date line', () => { expect(distanceKm([-16.65, 13.27], [-16.65, 13.27])).toBe(0); expect(distanceKm([179.9, 0], [-179.9, 0])).toBeLessThan(23); });
});
