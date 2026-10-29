import { readdir, readFile } from 'node:fs/promises';
import { loadConfig } from '../src/config/env.js';
const config = loadConfig();
const secrets = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
let checked = 0;
const violations = [];
async function scan(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), folder);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(?:js|jsx|mjs|json|css|html|svg|txt)$/.test(entry.name)) {
      const text = await readFile(file, 'utf8');
      checked++;
      for (const key of secrets) if (config[key] && text.includes(config[key])) violations.push({ key, file: file.pathname.split('/frontend/')[1] });
    }
  }
}
for (const path of ['src/', 'public/', 'dist/']) await scan(new URL('../../frontend/' + path, import.meta.url));
console.log(JSON.stringify({ filesChecked: checked, secretExposureCount: violations.length, violations }));
process.exitCode = violations.length ? 1 : 0;
