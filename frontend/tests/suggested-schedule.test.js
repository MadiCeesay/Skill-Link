import { expect, it } from 'vitest';
import { suggestedSchedule } from '../src/features/jobs';

const now = new Date('2026-11-19T15:02:00');
it('uses the offer date at 09:00 and its duration when the date is ahead', () => {
  expect(suggestedSchedule({ proposedSchedule: { date: '2026-11-20' }, estimatedDurationMinutes: 90 }, now))
    .toEqual({ scheduledStart: '2026-11-20T09:00', scheduledEnd: '2026-11-20T10:30' });
});
it('falls back to about 30 minutes from now, rounded to 5 minutes', () => {
  expect(suggestedSchedule({ proposedSchedule: { date: '2026-11-19' } }, now))
    .toEqual({ scheduledStart: '2026-11-19T15:35', scheduledEnd: '2026-11-19T16:35' });
});
