import { z } from 'zod';
import { objectId, text } from '../../utils/validation.js';
export const conversationWrite = z
  .object({
    contextType: z.enum(['QUOTE', 'DIRECT_PROPOSAL', 'BOOKING']),
    contextId: objectId,
  })
  .strict();
// Languages a sender can choose for a voice note (English, Wolof, French).
export const SPOKEN_LANGUAGES = ['eng', 'wol', 'fra'];
const clientMessageId = text(80).regex(/^[A-Za-z0-9_-]+$/);
export const chatPriceWrite = z.object({ amountBututs: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }).strict();
export const chatPriceResponse = z.object({ decision: z.enum(['ACCEPTED', 'DECLINED']) }).strict();
export const messageWrite = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('TEXT'), text: text(2000), clientMessageId })
    .strict(),
  z
    .object({ type: z.literal('IMAGE'), media: objectId, clientMessageId })
    .strict(),
  z
    // language: what the sender says they are speaking, as an ISO 639-3 code.
    // Telling the transcriber the language is much more accurate than letting it guess.
    .object({ type: z.literal('VOICE'), media: objectId, clientMessageId, language: z.enum(SPOKEN_LANGUAGES).optional() })
    .strict(),
]);
