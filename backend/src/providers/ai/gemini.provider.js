import { ApiError } from '../../utils/ApiError.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

/**
 * Minimal client for Google's Gemini generateContent REST endpoint.
 * The API key stays on the server and is sent in a header, never in the URL.
 */
export class GeminiProvider {
  name = 'gemini';
  available = true;

  /**
   * @param {object} options
   * @param {string} options.apiKey
   * @param {string} options.model one model, or several separated by commas: the first is
   *   preferred and the others are backups used when it is busy or unavailable.
   */
  constructor({ apiKey, model, thinkingLevel = 'low', fetchImpl = globalThis.fetch, timeoutMs = 30000, log = true }) {
    this.apiKey = apiKey;
    // Gemini 3 models "think" before answering; 'low' keeps drafting fast. 'off' sends no setting.
    this.thinkingLevel = thinkingLevel === 'off' ? null : thinkingLevel;
    this.log = log;
    this.models = String(model).split(',').map(name => name.trim()).filter(Boolean);
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Sends instructions plus the customer's text, photos or voice note and
   * returns the model's answer parsed as JSON.
   * @param {{ system: string, parts: Array<{text:string}|{inlineData:{mimeType:string,data:string}}> }} request
   */
  async generateJson({ system, parts }) {
    const request = thinking => JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      // Low temperature keeps answers consistent; JSON mode avoids free text.
      generationConfig: {
        temperature: 0.2, responseMimeType: 'application/json',
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
      },
    });
    let lastError;
    // Try the preferred model first; if Google reports it busy, missing or slow, try the next one.
    for (const model of this.models) {
      const started = Date.now();
      try {
        let result;
        try { result = await this.callModel(model, request(this.thinkingLevel)); }
        catch (error) {
          // A model that does not accept this thinking setting: ask again with its default.
          if (!this.thinkingLevel || !/thinking/i.test(error.reason || '')) throw error;
          result = await this.callModel(model, request(null));
        }
        if (this.log) console.info('[assistant] ' + model + ' answered in ' + ((Date.now() - started) / 1000).toFixed(1) + ' s');
        return result;
      } catch (error) {
        lastError = error;
        // Logged without any customer content, so failures can be diagnosed from the terminal.
        if (this.log) console.warn('[assistant] Gemini model ' + model + ' failed: ' + error.reason);
        if (!error.retryWithAnotherModel) break;
      }
    }
    throw lastError.apiError;
  }

  async callModel(model, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetch(GEMINI_URL + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error.name === 'AbortError' ? 'no answer within ' + this.timeoutMs / 1000 + ' seconds'
        : 'network error: ' + (error.cause?.code || error.cause?.message || error.message);
      throw failure(new ApiError(503, 'AI_UNAVAILABLE', 'The assistant is not responding right now. Please describe the job yourself.'), true, reason);
    } finally {
      clearTimeout(timer);
    }
    // 429 rate limit, 503 overloaded, 404 model retired: another model may still work.
    if ([429, 503, 404, 500].includes(response.status))
      throw failure(new ApiError(503, 'AI_BUSY', 'The assistant is busy. Please try again in a minute.'), true, 'HTTP ' + response.status + ' ' + await errorMessage(response));
    if (!response.ok) throw failure(new ApiError(502, 'AI_PROVIDER_ERROR', 'The assistant could not help with this request.'), false, 'HTTP ' + response.status + ' ' + await errorMessage(response));
    const result = await response.json().catch(() => null);
    const text = result?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    try { return parseJson(text); }
    catch (error) { throw failure(error, true, 'answer was not valid JSON (finish reason: ' + (result?.candidates?.[0]?.finishReason || 'none') + ')'); }
  }
}

function failure(apiError, retryWithAnotherModel, reason = apiError.code) {
  return { apiError, retryWithAnotherModel, reason };
}

// Google's own error text, e.g. "This model is currently experiencing high demand".
async function errorMessage(response) {
  try { return ((await response.json())?.error?.message || '').slice(0, 200); }
  catch { return ''; }
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
