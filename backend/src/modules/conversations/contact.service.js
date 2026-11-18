import { ApiError } from '../../utils/ApiError.js';
export function hasContact(value) {
  const t = value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  // Explicit currency/measurement labels distinguish common work quantities from bare phone numbers.
  const numbers = t
    .replace(/\b(?:GMD|bututs?|price|cost)\s*[:=]?\s*\d+(?:[,.]\d+)*/gi, '')
    .replace(
      /\b\d+(?:[,.]\d+)*\s*(?:dalasis?|metres?|meters?|mm|cm|kg|bricks?|bags?|units?)\b/gi,
      '',
    );
  return (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(t) ||
    /\b(?:wa\.me|whatsapp\.com|facebook\.com|instagram\.com|t\.me|telegram\.me|snapchat\.com|linkedin\.com)\//i.test(
      t,
    ) ||
    // Gambian numbers with the country code. Since 4 September 2026 PURA moved
    // Africell, Comium and QCell from 7 to 9 digits, so both lengths are blocked.
    /(?:\+|00)220[\s().-]*[2-9](?:[\s().-]*\d){6}(?:(?:[\s().-]*\d){2})?(?!\d)/.test(t) ||
    // Old 7-digit local numbers, e.g. 3123456 or 312 34 56.
    /(?:^|[^\d])[235679]\d{2}[ -]?\d{2}[ -]?\d{2}(?!\d)/.test(numbers) ||
    // New 9-digit local numbers, also when digits are spaced out, e.g. 877 123 456 or 8 7 7 1 2 3 4 5 6.
    /(?:^|[^\d])[2-9](?:[\s.-]?\d){8}(?![\s.-]?\d)/.test(numbers)
  );
}
export function assertNoContact(text) {
  if (hasContact(text))
    throw new ApiError(
      400,
      'CONTACT_SHARING_BLOCKED',
      'For your safety, keep communication within SkillLink until the booking is confirmed.',
    );
}
