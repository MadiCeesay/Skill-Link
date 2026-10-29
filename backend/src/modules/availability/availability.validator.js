import { z } from 'zod';
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    'Invalid date',
  );
export const instant = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(v));
export const schedule = z
  .object({ scheduledStart: instant, scheduledEnd: instant })
  .strict()
  .refine(
    (v) =>
      v.scheduledStart < v.scheduledEnd &&
      v.scheduledStart > new Date() &&
      v.scheduledEnd - v.scheduledStart <= 24 * 3600000 &&
      v.scheduledStart - Date.now() <= 365 * 86400000,
    'Use a future interval of at most 24 hours within the next year',
  );
export const availabilityWrite = z
  .object({
    weekly: z
      .array(
        z
          .object({
            day: z.number().int().min(0).max(6),
            start: time,
            end: time,
          })
          .strict(),
      )
      .max(35),
    blockedDates: z.array(dateOnly).max(366).default([]),
    timeOff: z
      .array(z.object({ start: instant, end: instant }).strict())
      .max(100)
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const i of v.weekly)
      if (i.start >= i.end)
        ctx.addIssue({ code: 'custom', message: 'Start must precede end' });
    for (let a = 0; a < v.weekly.length; a++)
      for (let b = a + 1; b < v.weekly.length; b++) {
        const x = v.weekly[a],
          y = v.weekly[b];
        if (x.day === y.day && x.start < y.end && x.end > y.start)
          ctx.addIssue({ code: 'custom', message: 'Weekly intervals overlap' });
      }
    if (v.timeOff.some((i) => i.start >= i.end))
      ctx.addIssue({ code: 'custom', message: 'Invalid time off interval' });
    if (new Set(v.blockedDates).size !== v.blockedDates.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate blocked date' });
  });
export const availableNowWrite = z
  .object({ availableNow: z.boolean() })
  .strict();
