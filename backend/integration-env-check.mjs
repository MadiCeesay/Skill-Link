import fs from 'node:fs';
import dotenv from 'dotenv';
const text = fs.readFileSync('.env', 'utf8');
const parsed = dotenv.parse(text);
for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
  const value = parsed[key] || '';
  const line = text.split(/\r?\n/).find(item => item.startsWith(key + '=')) || '';
  console.log(JSON.stringify({ key, length: value.length, whitespace: value !== value.trim(), placeholder: /your_|replace|example|cloudinary:\/\//i.test(value), unquotedHash: line.includes('#') && !/^\w+=["']/.test(line) }));
}
