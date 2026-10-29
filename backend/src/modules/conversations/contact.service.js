import { ApiError } from '../../utils/ApiError.js';
export function hasContact(value) {
  const t = value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  // Explicit currency/measurement labels distinguish common work quantities from bare phone numbers.
  const numbers = t
    .replace(/\b(?:GMD|bututs?|price|cost)\s*[:=]?\s*\d+(?:[,.]\d+)*/gi, '')
    .replace(
      /\b\d+(?:\.\d+)?\s*(?:metres?|meters?|mm|cm|kg|bricks?|bags?|units?)\b/gi,
      '',
    );
  return (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(t) ||
    /\b(?:wa\.me|whatsapp\.com|facebook\.com|instagram\.com|t\.me|telegram\.me|snapchat\.com|linkedin\.com)\//i.test(
      t,
    ) ||
    /(?:\+|00)220[\s().-]*[2-9](?:[\s().-]*\d){6}(?!\d)/.test(t) ||
    /(?:^|[^\d])[235679]\d{2}[ -]?\d{2}[ -]?\d{2}(?!\d)/.test(numbers)
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
