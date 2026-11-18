import { ApiError } from '../../utils/ApiError.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

/**
 * Minimal client for Google's Gemini generateContent REST endpoint.
 * The API key stays on the server and is sent in a header, never in the URL.
 */
export class GeminiProvider {
  name = 'gemini';
  available = true;

  constructor({ apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 25000 }) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Sends instructions plus the customer's text, photos or voice note and
   * returns the model's answer parsed as JSON.
   * @param {{ system: string, parts: Array<{text:string}|{inlineData:{mimeType:string,data:string}}> }} request
   */
  async generateJson({ system, parts }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetch(GEMINI_URL + encodeURIComponent(this.model) + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          // Low temperature keeps answers consistent; JSON mode avoids free text.
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(503, 'AI_UNAVAILABLE', 'The assistant is not responding right now. Please describe the job yourself.');
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 429) throw new ApiError(503, 'AI_BUSY', 'The assistant is busy. Please try again in a minute.');
    if (!response.ok) throw new ApiError(502, 'AI_PROVIDER_ERROR', 'The assistant could not help with this request.');
    const body = await response.json().catch(() => null);
    const text = body?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    return parseJson(text);
  }
}

// Accepts plain JSON or JSON wrapped in ``` fences.
export function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); }
  catch { throw new ApiError(502, 'AI_PROVIDER_ERROR', 'The assistant could not help with this request.'); }
}

/** Used when no API key is configured: the feature is simply switched off. */
export class UnavailableAiProvider {
  name = 'none';
  available = false;
  async generateJson() {
    throw new ApiError(503, 'AI_UNAVAILABLE', 'The assistant is not available. Please describe the job yourself.');
  }
}
