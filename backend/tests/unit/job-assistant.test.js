import { describe, it, expect, vi } from 'vitest';
import { GeminiProvider, parseJson, UnavailableAiProvider } from '../../src/providers/ai/gemini.provider.js';
import { jobDraftInput } from '../../src/modules/assistant/job-assistant.routes.js';

const ok = body => ({ ok: true, status: 200, json: async () => body });
const answer = text => ({ candidates: [{ content: { parts: [{ text }] } }] });

describe('Gemini provider', () => {
  it('sends the key in a header, never in the URL, and asks for JSON', async () => {
    const fetchImpl = vi.fn(async () => ok(answer('{"title":"Fix tap"}')));
    const provider = new GeminiProvider({ apiKey: 'secret-key', model: 'gemini-flash-latest', fetchImpl });
    expect(await provider.generateJson({ system: 'rules', parts: [{ text: 'hi' }] })).toEqual({ title: 'Fix tap' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(url).not.toContain('secret-key');
    expect(init.headers['x-goog-api-key']).toBe('secret-key');
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toBe('rules');
  });
  it('falls back to the next model when the first is overloaded', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(ok(answer('{"title":"Fix tap"}')));
    const provider = new GeminiProvider({ apiKey: 'k', model: 'busy-model, backup-model', fetchImpl, log: false });
    expect(await provider.generateJson({ system: '', parts: [] })).toEqual({ title: 'Fix tap' });
    expect(fetchImpl.mock.calls.map(([url]) => url.split('/models/')[1])).toEqual(['busy-model:generateContent', 'backup-model:generateContent']);
  });
  it('does not retry other models for a bad request', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400 }));
    const provider = new GeminiProvider({ apiKey: 'k', model: 'a-1,b-2', fetchImpl });
    await expect(provider.generateJson({ system: '', parts: [] })).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('accepts JSON wrapped in code fences', () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('turns provider failures into friendly errors', async () => {
    const busy = new GeminiProvider({ apiKey: 'k', model: 'm-1', fetchImpl: async () => ({ ok: false, status: 429 }) });
    await expect(busy.generateJson({ system: '', parts: [] })).rejects.toMatchObject({ status: 503, code: 'AI_BUSY' });
    const down = new GeminiProvider({ apiKey: 'k', model: 'm-1', fetchImpl: async () => { throw new Error('offline'); } });
    await expect(down.generateJson({ system: '', parts: [] })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    const junk = new GeminiProvider({ apiKey: 'k', model: 'm-1', fetchImpl: async () => ok(answer('not json')) });
    await expect(junk.generateJson({ system: '', parts: [] })).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR' });
  });
  it('is switched off without a key', async () => {
    const off = new UnavailableAiProvider();
    expect(off.available).toBe(false);
    await expect(off.generateJson()).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });
});

describe('job draft input', () => {
  const id = 'a'.repeat(24);
  it('needs text, a photo or a voice note', () => {
    expect(jobDraftInput.safeParse({}).success).toBe(false);
    expect(jobDraftInput.safeParse({ text: 'hi' }).success).toBe(false);
    expect(jobDraftInput.safeParse({ text: 'leaking roof' }).success).toBe(true);
    expect(jobDraftInput.safeParse({ photos: [id] }).success).toBe(true);
    expect(jobDraftInput.safeParse({ voice: id }).success).toBe(true);
  });
  it('limits photos and rejects unknown fields', () => {
    expect(jobDraftInput.safeParse({ photos: ['a', 'b', 'c', 'd'].map(c => c.repeat(24)) }).success).toBe(false);
    expect(jobDraftInput.safeParse({ photos: [id, id] }).success).toBe(false);
    expect(jobDraftInput.safeParse({ text: 'leaking roof', userId: id }).success).toBe(false);
  });
});
