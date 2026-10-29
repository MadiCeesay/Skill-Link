// Read-only live preflight. Never print configuration values, driver errors or provider URLs.
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { loadConfig } from '../src/config/env.js';
const config = loadConfig();
let failed = false;
console.log(JSON.stringify({ frontendOrigin: config.FRONTEND_ORIGIN, apiPort: config.PORT, mediaProvider: config.MEDIA_PROVIDER, paymentProvider: config.PAYMENT_PROVIDER }));
try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  console.log(JSON.stringify({ databaseConnected: true, transactionsSupported: Boolean(hello.setName || hello.msg === 'isdbgrid') }));
} catch { console.log(JSON.stringify({ databaseConnected: false })); failed = true; }
finally { await mongoose.disconnect(); }
try {
  const response = await fetch(`http://localhost:${config.PORT}/api/ready`, { signal: AbortSignal.timeout(15000) });
  console.log(JSON.stringify({ apiReady: response.ok, status: response.status }));
  if (!response.ok) failed = true;
} catch { console.log(JSON.stringify({ apiReady: false })); failed = true; }
try {
  if (config.MEDIA_PROVIDER !== 'cloudinary') throw Error('Cloudinary not selected');
  await cloudinary.api.ping({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET, timeout: 15000 });
  console.log(JSON.stringify({ cloudinaryAuthenticated: true }));
} catch (error) { console.log(JSON.stringify({ cloudinaryAuthenticated: false, status: error.error?.http_code || error.http_code || null })); failed = true; }
process.exitCode = failed ? 1 : 0;
