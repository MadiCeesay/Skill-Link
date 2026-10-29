import { z } from 'zod';
import { objectId, text } from '../../utils/validation.js';
export const conversationWrite = z
  .object({
    contextType: z.enum(['QUOTE', 'DIRECT_PROPOSAL', 'BOOKING']),
    contextId: objectId,
  })
  .strict();
const clientMessageId = text(80).regex(/^[A-Za-z0-9_-]+$/);
export const messageWrite = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('TEXT'), text: text(2000), clientMessageId })
    .strict(),
  z
    .object({ type: z.literal('IMAGE'), media: objectId, clientMessageId })
    .strict(),
  z
    .object({ type: z.literal('VOICE'), media: objectId, clientMessageId })
    .strict(),
]);
