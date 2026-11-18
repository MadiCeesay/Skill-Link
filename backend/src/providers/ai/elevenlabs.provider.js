import { ApiError } from '../../utils/ApiError.js';

const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const EXTENSION = { 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/wav': 'wav' };

/**
 * Speech to text with ElevenLabs Scribe. The API key stays on the server.
 * `model` may list backups separated by commas, e.g. "scribe_v2,scribe_v1".
 */
export class ElevenLabsTranscriber {
  name = 'elevenlabs';
  available = true;

  constructor({ apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 60000, log = true }) {
    this.apiKey = apiKey;
    this.models = String(model).split(',').map(name => name.trim()).filter(Boolean);
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.log = log;
  }

  /**
   * @param {{ buffer: Buffer, mimeType: string, languageCode?: string }} audio
   *   languageCode (ISO 639-3, e.g. "wol") skips automatic detection, which often
   *   mistakes short Gambian Wolof clips for other languages.
   * @returns {Promise<{ text: string, languageCode: string|null, model: string }>}
   */
  async transcribe({ buffer, mimeType, languageCode }) {
    let lastReason = 'no model configured';
    for (const model of this.models) {
      const form = new FormData();
      form.append('model_id', model);
      form.append('tag_audio_events', 'false');
      if (languageCode) form.append('language_code', languageCode);
      form.append('file', new Blob([buffer], { type: mimeType }), 'voice-note.' + (EXTENSION[mimeType] || 'ogg'));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetch(ELEVENLABS_URL, { method: 'POST', headers: { 'xi-api-key': this.apiKey }, body: form, signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          return { text: String(result.text || '').trim(), languageCode: result.language_code || null, model };
        }
        lastReason = 'HTTP ' + response.status + ' ' + (await response.text().catch(() => '')).slice(0, 200);
        // A wrong or missing key will fail for every model, so stop early.
        if (response.status === 401 || response.status === 403) break;
      } catch (error) {
        lastReason = error.name === 'AbortError' ? 'no answer within ' + this.timeoutMs / 1000 + ' seconds' : 'network error: ' + (error.cause?.code || error.message);
      } finally {
        clearTimeout(timer);
      }
      if (this.log) console.warn('[transcription] ElevenLabs model ' + model + ' failed: ' + lastReason);
    }
    throw new ApiError(503, 'TRANSCRIPTION_UNAVAILABLE', 'The voice note could not be transcribed: ' + lastReason);
  }
}

/** Used when no API key is configured: voice notes simply have no transcript. */
export class UnavailableTranscriber {
  name = 'none';
  available = false;
  async transcribe() {
    throw new ApiError(503, 'TRANSCRIPTION_UNAVAILABLE', 'Voice transcription is not configured');
  }
}
