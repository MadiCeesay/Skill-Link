// Synthetic microphone diagnostic. No credentials, voice contents or provider
// URLs are printed or persisted. Uses the real browser MediaRecorder output.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { audioFormat } from '../../backend/src/modules/media/audio.validator.js';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try {
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();
  await page.goto('http://localhost:5173');
  const recording = await page.evaluate(async () => {
    const requested = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
    if (!requested) throw Error('No supported browser recording type');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      const recorder = new MediaRecorder(stream, { mimeType: requested, audioBitsPerSecond: 48000 });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject; });
      recorder.start(); await new Promise(resolve => setTimeout(resolve, 3000)); recorder.stop(); await stopped;
      const actual = chunks[0]?.type || recorder.mimeType;
      const bytes = [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
      return { requested, actual, bytes };
    } finally { stream.getTracks().forEach(track => track.stop()); }
  });
  const bytes = Buffer.from(recording.bytes), mimeType = recording.actual.split(';')[0];
  const format = audioFormat(bytes, mimeType);
  const result = { requestedType: recording.requested, actualType: recording.actual, mimeType, bytes: bytes.length, backendAcceptedFormat: format, oldVideoMarkerMatched: bytes.includes(Buffer.from('V_')) };
  await writeFile(new URL('../../backend/.local-integration/audio-recording-proof.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch { console.log('Browser recording diagnostic failed; no audio or sensitive details printed.'); process.exitCode = 1; }
finally { await browser.close(); }
