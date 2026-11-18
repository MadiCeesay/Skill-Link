// Measures how accurately ElevenLabs transcribes your own recordings.
//
// 1. Put recordings in backend/transcription-eval/, e.g. 01-roof.ogg (ogg, webm or wav).
// 2. Next to each, add the exact words spoken in a text file with the same name: 01-roof.txt
// 3. Run from the backend folder: node scripts/evaluate-transcription.mjs [folder]
//
// Prints the word error rate (WER) per recording and overall, and saves results.csv.
// Uses ELEVENLABS_API_KEY and ELEVENLABS_MODEL from backend/.env.
import 'dotenv/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { ElevenLabsTranscriber } from '../src/providers/ai/elevenlabs.provider.js';
import { wordEdits } from '../src/modules/transcription/word-error-rate.js';

const folder = process.argv[2] || 'transcription-eval';
const mimeTypes = { '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.wav': 'audio/wav' };
const transcriber = new ElevenLabsTranscriber({
  apiKey: process.env.ELEVENLABS_API_KEY || '',
  model: process.env.ELEVENLABS_MODEL || 'scribe_v2,scribe_v1',
});

const audioFiles = (await readdir(folder)).filter(name => mimeTypes[extname(name).toLowerCase()]).sort();
if (!audioFiles.length) {
  console.log('No .ogg, .webm or .wav files found in ' + folder);
  process.exit(1);
}
const rows = [];
let totalEdits = 0, totalWords = 0;
for (const file of audioFiles) {
  const name = basename(file, extname(file));
  let reference;
  try { reference = (await readFile(join(folder, name + '.txt'), 'utf8')).trim(); }
  catch { console.log('Skipping ' + file + ': no ' + name + '.txt with the correct words'); continue; }
  const buffer = await readFile(join(folder, file));
  try {
    const result = await transcriber.transcribe({ buffer, mimeType: mimeTypes[extname(file).toLowerCase()] });
    const { edits, referenceWords } = wordEdits(reference, result.text);
    totalEdits += edits;
    totalWords += referenceWords;
    const wer = referenceWords ? edits / referenceWords : 0;
    rows.push({ file, language: result.languageCode || '', wer, reference, transcript: result.text });
    console.log(file.padEnd(28) + ' WER ' + (wer * 100).toFixed(1).padStart(5) + '%  (' + (result.languageCode || '?') + ')');
  } catch (error) {
    console.log(file.padEnd(28) + ' FAILED: ' + error.message);
  }
}
const overall = totalWords ? totalEdits / totalWords : 0;
console.log('\nOverall WER: ' + (overall * 100).toFixed(1) + '% over ' + rows.length + ' recordings (' + totalWords + ' reference words)');
const csv = (value) => '"' + String(value).replaceAll('"', '""') + '"';
await writeFile(join(folder, 'results.csv'),
  ['file,language,wer,reference,transcript', ...rows.map(r => [r.file, r.language, r.wer.toFixed(4), r.reference, r.transcript].map(csv).join(','))].join('\n'));
console.log('Saved ' + join(folder, 'results.csv'));
