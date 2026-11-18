import { describe, it, expect, vi } from 'vitest';
import { ElevenLabsTranscriber, UnavailableTranscriber } from '../../src/providers/ai/elevenlabs.provider.js';
import { words, wordEdits, wordErrorRate } from '../../src/modules/transcription/word-error-rate.js';

describe('word error rate', () => {
  it('ignores case and punctuation', () => {
    expect(words('Water, coming from the CEILING!')).toEqual(['water', 'coming', 'from', 'the', 'ceiling']);
    expect(wordErrorRate('Water is coming.', 'water is coming')).toBe(0);
  });
  it('counts substitutions, deletions and insertions', () => {
    expect(wordEdits('the roof is leaking', 'the roof was leaking')).toEqual({ edits: 1, referenceWords: 4 });
    expect(wordEdits('the roof is leaking', 'the roof leaking')).toEqual({ edits: 1, referenceWords: 4 });
    expect(wordEdits('the roof is leaking', 'the old roof is leaking')).toEqual({ edits: 1, referenceWords: 4 });
    expect(wordErrorRate('the roof is leaking', 'the roof was leaking')).toBe(0.25);
  });
  it('keeps letters from local languages', () => {
    expect(words('Ñaata la? Jërëjëf')).toEqual(['ñaata', 'la', 'jërëjëf']);
  });
  it('handles empty text', () => {
    expect(wordErrorRate('', '')).toBe(0);
    expect(wordErrorRate('', 'extra')).toBe(1);
    expect(wordErrorRate('hello there', '')).toBe(1);
  });
});

describe('ElevenLabs transcriber', () => {
  const audio = { buffer: Buffer.from([1, 2, 3]), mimeType: 'audio/ogg' };
  const ok = body => ({ ok: true, status: 200, json: async () => body });
  it('sends the audio with the key in a header and returns text and language', async () => {
    const fetchImpl = vi.fn(async () => ok({ text: ' Water is coming from the ceiling. ', language_code: 'wol' }));
    const t = new ElevenLabsTranscriber({ apiKey: 'secret', model: 'scribe_v2', fetchImpl, log: false });
    expect(await t.transcribe(audio)).toEqual({ text: 'Water is coming from the ceiling.', languageCode: 'wol', model: 'scribe_v2' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect(url).not.toContain('secret');
    expect(init.headers['xi-api-key']).toBe('secret');
    expect(init.body.get('model_id')).toBe('scribe_v2');
    expect(init.body.get('file').name).toBe('voice-note.ogg');
  });
  it('tries the backup model when the first fails', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'unknown model' })
      .mockResolvedValueOnce(ok({ text: 'hello', language_code: 'eng' }));
    const t = new ElevenLabsTranscriber({ apiKey: 'k', model: 'scribe_v2,scribe_v1', fetchImpl, log: false });
    expect((await t.transcribe(audio)).model).toBe('scribe_v1');
  });
  it('stops at an invalid key and explains the failure', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'invalid api key' }));
    const t = new ElevenLabsTranscriber({ apiKey: 'bad', model: 'scribe_v2,scribe_v1', fetchImpl, log: false });
    await expect(t.transcribe(audio)).rejects.toMatchObject({ code: 'TRANSCRIPTION_UNAVAILABLE', message: expect.stringContaining('HTTP 401') });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('is switched off without a key', () => {
    expect(new UnavailableTranscriber().available).toBe(false);
  });
});
