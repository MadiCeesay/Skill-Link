// Job description assistant.
//
// A customer describes a problem in their own words, with optional photos and an
// optional voice note. The AI turns it into a clear job description, picks the
// matching service from SkillLink's catalog and suggests a fair price range.
// The customer always reviews and edits the result before anything is posted.
// See backend/docs/job-assistant.md.
import { z } from 'zod';
import mongoose from 'mongoose';
import { Service } from '../catalog/service.model.js';
import { Category } from '../catalog/category.model.js';
import { Booking } from '../bookings/booking.model.js';
import { MediaAsset } from '../media/media.model.js';
import { hasContact } from '../conversations/contact.service.js';
import { ApiError } from '../../utils/ApiError.js';

const BUTUTS_PER_GMD = 100;
// Prices are rounded to the nearest 50 dalasi and kept within a sane range.
const ROUND_TO_BUTUTS = 50 * BUTUTS_PER_GMD;
const MIN_PRICE_BUTUTS = 50 * BUTUTS_PER_GMD;
const MAX_PRICE_BUTUTS = 200000 * BUTUTS_PER_GMD;
// Real SkillLink prices replace the AI estimate once a service has this many bookings.
export const MIN_BOOKINGS_FOR_MARKET_PRICE = 3;
const PRICED_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'WORKER_MARKED_COMPLETED', 'COMPLETED'];

// What we expect back from the model. Anything else is rejected.
const aiAnswer = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(3000),
  serviceName: z.string().trim().max(100).nullable().optional(),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  urgency: z.enum(['LOW', 'NORMAL', 'URGENT']).optional().default('NORMAL'),
  followUpQuestions: z.array(z.string().trim().min(3).max(200)).max(3).optional().default([]),
  priceMinGmd: z.number().nonnegative().nullable().optional(),
  priceMaxGmd: z.number().nonnegative().nullable().optional(),
  safetyNote: z.string().trim().max(300).nullable().optional(),
  transcript: z.string().trim().max(2000).nullable().optional(),
  detectedLanguage: z.string().trim().max(40).nullable().optional(),
});

function instructions(services) {
  return [
    'You help customers in The Gambia describe home and repair jobs for SkillLink, a marketplace of local skilled workers.',
    'The customer may write or speak in English, Wolof, Mandinka, Fula, French or a mix. Always answer in simple English.',
    'Write a short title and a clear description a worker can quote from: what is wrong, where in the home, how big the job looks, and anything urgent.',
    'Write the description in the first person, as the customer posting the job (for example "My toilet keeps running…"). Never write "the customer reports", "the user says" or "the image shows"; describe what the photos show as facts about the job.',
    'Only describe what the customer said or what is visible in the photos. Do not invent measurements, brands or causes; if something important is unknown, ask it in followUpQuestions (at most 3 short questions).',
    'Never include names, phone numbers, emails, addresses or other personal details in your answer.',
    'Choose serviceName from this exact list, or null if none fits: ' + services.map(s => JSON.stringify(s.name)).join(', ') + '.',
    'Suggest a typical labour price range in Gambian dalasi (GMD) for this job in the Greater Banjul area as priceMinGmd and priceMaxGmd, or null if you cannot tell.',
    'If there is a safety risk (exposed wires, gas smell, water near electrics, structural cracks), give one short safetyNote, otherwise null.',
    'If there is a voice note, put an English version of what the customer said in transcript and name the spoken language in detectedLanguage.',
    'Reply with JSON only, with keys: title, description, serviceName, confidence (0 to 1), urgency (LOW, NORMAL or URGENT), followUpQuestions, priceMinGmd, priceMaxGmd, safetyNote, transcript, detectedLanguage.',
  ].join('\n');
}

const roundPrice = bututs => Math.round(bututs / ROUND_TO_BUTUTS) * ROUND_TO_BUTUTS;
const clampPrice = bututs => Math.min(MAX_PRICE_BUTUTS, Math.max(MIN_PRICE_BUTUTS, roundPrice(bututs)));

function percentile(sorted, fraction) {
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/** Middle half (25th–75th percentile) of real SkillLink prices for a service in the last year. */
export async function marketPriceRange(serviceId, now = new Date()) {
  const since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  // The app runs Mongoose with sanitizeFilter on, so query operators we write
  // ourselves must be marked as trusted.
  const rows = await Booking.find({ service: serviceId, status: mongoose.trusted({ $in: PRICED_STATUSES }), createdAt: mongoose.trusted({ $gte: since }) })
    .select('agreedAmountBututs').limit(1000).lean();
  const amounts = rows.map(r => r.agreedAmountBututs).filter(Number.isFinite).sort((a, b) => a - b);
  if (amounts.length < MIN_BOOKINGS_FOR_MARKET_PRICE) return null;
  return {
    minBututs: clampPrice(percentile(amounts, 0.25)),
    maxBututs: clampPrice(percentile(amounts, 0.75)),
    source: 'SKILLLINK_BOOKINGS',
    sampleSize: amounts.length,
  };
}

function aiPriceRange(answer) {
  const { priceMinGmd: min, priceMaxGmd: max } = answer;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0) return null;
  const low = clampPrice(Math.min(min, max) * BUTUTS_PER_GMD);
  const high = clampPrice(Math.max(min, max) * BUTUTS_PER_GMD);
  return { minBututs: low, maxBututs: Math.max(low, high), source: 'AI_ESTIMATE' };
}

/**
 * @param {object} ai AI provider (GeminiProvider or UnavailableAiProvider)
 * @param {object} media media service, used to read the customer's own uploads
 * @param {Function} fetchImpl downloads a signed media URL (injected for tests)
 */
export function jobAssistantService(ai, media, fetchImpl = globalThis.fetch) {
  // Reads the customer's own uploaded file and returns it as base64 for the AI.
  async function inlineMedia(id, owner, purpose) {
    const asset = await MediaAsset.findOne({ _id: id, owner, purpose }).select('+storageKey +resourceType +format +deliveryType');
    if (!asset) throw new ApiError(400, 'INVALID_MEDIA', 'Select your own uploaded media with the correct purpose');
    const { url } = await media.link(asset, 60);
    const response = await fetchImpl(url).catch(() => null);
    if (!response?.ok) throw new ApiError(502, 'MEDIA_PROVIDER_ERROR', 'Media could not be read');
    const data = Buffer.from(await response.arrayBuffer()).toString('base64');
    return { inlineData: { mimeType: asset.mimeType, data } };
  }

  return {
    status() {
      return { jobDraft: ai.available };
    },

    async draftJob(user, input) {
      if (!ai.available) throw new ApiError(503, 'AI_UNAVAILABLE', 'The assistant is not available. Please describe the job yourself.');
      const text = input.text?.trim() || '';
      // Personal contact details must never be sent to the AI provider.
      if (text && hasContact(text)) throw new ApiError(400, 'CONTACT_SHARING_BLOCKED', 'Remove phone numbers, emails and links before using the assistant.');

      const activeCategories = await Category.find({ isActive: true }).select('_id').lean();
      const services = await Service.find({ isActive: true, category: mongoose.trusted({ $in: activeCategories.map(c => c._id) }) })
        .select('name').sort({ name: 1 }).lean();
      if (!services.length) throw new ApiError(503, 'AI_UNAVAILABLE', 'The assistant is not available. Please describe the job yourself.');

      const parts = [{ text: text ? 'Customer description: ' + text : 'The customer did not type a description.' }];
      for (const id of input.photos || []) parts.push(await inlineMedia(id, user._id, 'JOB_ATTACHMENT'));
      if (input.voice) {
        parts.push({ text: 'The customer also recorded this voice note:' });
        parts.push(await inlineMedia(input.voice, user._id, 'VOICE_NOTE'));
      }

      const raw = await ai.generateJson({ system: instructions(services), parts });
      const parsed = aiAnswer.safeParse(raw);
      if (!parsed.success) throw new ApiError(502, 'AI_PROVIDER_ERROR', 'The assistant could not help with this request. Please describe the job yourself.');
      const answer = parsed.data;
      // Belt and braces: never show AI text that contains contact details.
      if (hasContact(answer.title) || hasContact(answer.description)) throw new ApiError(502, 'AI_PROVIDER_ERROR', 'The assistant could not help with this request. Please describe the job yourself.');

      const service = answer.serviceName
        ? services.find(s => s.name.toLowerCase() === answer.serviceName.toLowerCase())
        : null;
      const priceRange = (service && await marketPriceRange(service._id)) || aiPriceRange(answer);

      return {
        draft: {
          title: answer.title,
          description: answer.description,
          service: service ? { id: String(service._id), name: service.name } : null,
          confidence: Math.round(answer.confidence * 100) / 100,
          urgency: answer.urgency,
          followUpQuestions: answer.followUpQuestions.filter(q => !hasContact(q)),
          priceRange,
          safetyNote: answer.safetyNote && !hasContact(answer.safetyNote) ? answer.safetyNote : null,
          transcript: input.voice && answer.transcript && !hasContact(answer.transcript) ? answer.transcript : null,
          detectedLanguage: input.voice ? answer.detectedLanguage || null : null,
        },
      };
    },
  };
}
