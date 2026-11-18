// Runs one real assistant request with the settings in backend/.env and shows
// what each Gemini model does. Prints no secrets.
// Run from the backend folder: node scripts/check-assistant.mjs
import 'dotenv/config';
import { GeminiProvider } from '../src/providers/ai/gemini.provider.js';

const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash,gemini-2.5-flash-lite,gemini-flash-latest';
const provider = new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY || '', model });
console.log('Models to try:', provider.models.join(' -> '));
const started = Date.now();
try {
  const answer = await provider.generateJson({
    system: 'You help customers in The Gambia describe repair jobs. Reply with JSON only, with keys title and description.',
    parts: [{ text: 'Customer description: water is coming from my ceiling whenever it rains' }],
  });
  console.log('OK after', ((Date.now() - started) / 1000).toFixed(1), 'seconds:', answer);
} catch (error) {
  console.log('FAILED after', ((Date.now() - started) / 1000).toFixed(1), 'seconds:', error.code, '-', error.message);
}
