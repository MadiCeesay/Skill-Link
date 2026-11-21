// Sends one test SMS through SMS.to using the settings in backend/.env.
// Usage: node scripts/check-sms.mjs +2207XXXXXX
// Prints only whether the key is set and the result, never the key itself.
import 'dotenv/config';
import { SmsToProvider, smsText } from '../src/providers/sms/smsto.provider.js';

const to = process.argv[2];
const key = process.env.SMSTO_API_KEY;
console.log('SMS_PROVIDER    ', process.env.SMS_PROVIDER || 'missing (defaults to disabled)');
console.log('SMSTO_API_KEY   ', key ? `set (${key.length} characters)` : 'missing');
console.log('SMSTO_SENDER_ID ', process.env.SMSTO_SENDER_ID || 'SkillLink (default)');
if (!/^\+[1-9]\d{7,14}$/.test(to || '')) {
  console.log('\nGive your own number in international format, e.g. node scripts/check-sms.mjs +2207012345');
  process.exit(1);
}
if (!key) {
  console.log('\nPROBLEM: add SMSTO_API_KEY to backend/.env first.');
  process.exit(1);
}
const sms = new SmsToProvider({ apiKey: key, senderId: process.env.SMSTO_SENDER_ID });
const message = smsText('BOOKING_CONFIRMED', process.env.FRONTEND_ORIGIN);
try {
  const result = await sms.send({ to, message });
  console.log('\nSent:', JSON.stringify(message), result.id ? '(id ' + result.id + ')' : '');
  console.log('If it does not arrive within a minute, check Reports/Logs in the SMS.to dashboard.');
  if (process.env.SMS_PROVIDER !== 'smsto') console.log('Note: set SMS_PROVIDER=smsto so the app sends alerts too.');
} catch (error) {
  console.log('\nFAILED:', error.message);
  console.log('401 = wrong key · 402/insufficient = no credit · sender errors = try SMSTO_SENDER_ID=SMSto');
  process.exit(1);
}
