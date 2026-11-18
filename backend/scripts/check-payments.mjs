// Shows whether the payment settings are present, without printing any secret.
import 'dotenv/config';
const show = name => { const v = process.env[name]; return v ? `set (${v.length} characters${v.startsWith('sk_test_') ? ', test key' : v.startsWith('sk_live_') ? ', LIVE key' : ''})` : 'missing'; };
console.log('PAYMENT_PROVIDER       ', process.env.PAYMENT_PROVIDER || 'missing (defaults to mock)');
console.log('MODEMPAY_SECRET_KEY    ', show('MODEMPAY_SECRET_KEY'));
console.log('MODEMPAY_WEBHOOK_SECRET', show('MODEMPAY_WEBHOOK_SECRET'), '(optional on localhost)');
console.log('MODEMPAY_AMOUNT_UNIT   ', process.env.MODEMPAY_AMOUNT_UNIT || 'GMD (default)');
console.log('PUBLIC_API_URL         ', process.env.PUBLIC_API_URL || 'empty (fine on localhost)');
try {
  const { loadConfig } = await import('../src/config/env.js');
  const c = loadConfig();
  if (c.PAYMENT_PROVIDER === 'modempay' && !c.MODEMPAY_SECRET_KEY) console.log('\nPROBLEM: PAYMENT_PROVIDER=modempay but MODEMPAY_SECRET_KEY is empty');
  else console.log('\nConfiguration is valid. If the server still fails, the database connection is the problem.');
} catch (e) { console.log('\nPROBLEM:', e.message); }
