import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';
import { requestCooldown, retryAt } from '../src/api/rate-limit';
import { affectedPaths } from '../src/api/invalidation';
import { servicePresentation } from '../src/utils/service-presentation';
afterEach(() => { requestCooldown.reset(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('stops other API calls during a global 429 wait and resumes after the deadline', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T00:00:00Z'));
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } }), { status: 429, headers: { 'Retry-After': '120', 'X-SkillLink-Rate-Limit': 'global' } })).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { services: [] } })));
  vi.stubGlobal('fetch', fetcher);
  await expect(api('/admin/ledger')).rejects.toMatchObject({ status: 429, retryAt: Date.now() + 120000 });
  await expect(api('/services')).rejects.toMatchObject({ status: 429 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(121000);
  await expect(api('/services')).resolves.toEqual({ services: [] });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not pause public browsing for an authentication-only rate limit', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts; try again later' } }), { status: 429, headers: { 'Retry-After': '60' } })).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { services: [] } }))));
  await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 429 });
  await expect(api('/services')).resolves.toEqual({ services: [] });
});
it('supports Retry-After dates and conservative fallback for missing headers', () => {
  const now = Date.parse('2026-10-27T00:00:00Z');
  expect(retryAt('Tue, 27 Oct 2026 00:02:00 GMT', now)).toBe(now + 120000);
  expect(retryAt(null, now)).toBe(now + 60000);
});
it('refreshes relevant booking/payment resources without refetching the admin ledger for profile edits', () => {
  expect(affectedPaths('/workers/me/profile')).not.toContain('/admin/ledger');
  expect(affectedPaths('/payments/bookings/123/checkout')).toEqual(expect.arrayContaining(['/payments/', '/bookings/', '/finances/']));
});
it.each([
  ['Carpentry', 'carpentry'], ['Electrician', 'electrical'], ['Plumbing', 'plumbing'],
  ['Painting', 'painting'], ['Masonry', 'masonry'], ['House cleaning', 'cleaning'],
  ['Tailoring', 'tailoring'], ['Appliance repair', 'appliance'], ['Computer Repair', 'technology'],
])('keeps %s matched to its proper tools after filtering/reordering', (name, key) => {
  expect(servicePresentation({ name }).key).toBe(key);
  expect(servicePresentation({ name, id: 'different-position' }).key).toBe(key);
});
