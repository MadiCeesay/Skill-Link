// Inspect configured secret values in memory; never print their contents.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { parse } = require('dotenv');
const secrets = [];
for (const file of [join(root, '.env'), join(root, '../backend/.env')]) {
  if (!existsSync(file)) continue;
  for (const [key, value] of Object.entries(parse(readFileSync(file)))) {
    if (/(SECRET|TOKEN|PASSWORD|MONGODB_URI|CLOUDINARY_URL|API_KEY)/i.test(key) && value.length >= 8) secrets.push(value);
  }
}
let checked = 0, exposures = 0;
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(js|jsx|json|html|css|md|map)$/.test(entry.name)) {
      checked += 1;
      const content = readFileSync(file, 'utf8');
      if (secrets.some(secret => content.includes(secret))) exposures += 1;
    }
  }
}
for (const path of ['src', 'dist', 'docs']) if (existsSync(join(root, path))) scan(join(root, path));
console.log(JSON.stringify({ checkedFiles: checked, configuredSecretExposures: exposures }));
if (exposures) process.exitCode = 1;
