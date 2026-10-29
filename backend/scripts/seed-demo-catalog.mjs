// Additive operator tool. Existing categories/services, including inactive
// entries, are preserved. No users or marketplace records are changed.
import { readFile } from 'node:fs/promises';
import { loadConfig } from '../src/config/env.js';
const config = loadConfig();
if (config.NODE_ENV !== 'development') throw Error('Demo catalog setup requires development mode');
const base = `http://localhost:${config.PORT}/api`;
const { admin } = JSON.parse(await readFile(new URL('../.local-integration/accounts.json', import.meta.url), 'utf8'));
let token;
async function api(path, body) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw Error('Catalog request failed: ' + response.status + ' ' + result.error?.code);
  return result.data;
}
try {
  token = (await api('/auth/login', { email: admin.email, password: admin.password })).accessToken;
  async function all(kind) {
    const result = [];
    for (let page = 1; ; page++) {
      const data = (await api(`/admin/catalog/${kind}?page=${page}&limit=100`))[kind];
      result.push(...data); if (data.length < 100) return result;
    }
  }
  const categories = await all('categories'), services = await all('services');
  console.log(JSON.stringify({ categories: categories.map(c => ({ name: c.name, active: c.isActive })), services: services.map(s => ({ name: s.name, active: s.isActive, categoryActive: categories.find(c => c.id === s.category)?.isActive })) }));
  if (process.argv.includes('--apply')) {
    const groups = [['Home & Utility', ['Electrician', 'Carpentry', 'Plumbing', 'Painting', 'Masonry', 'Appliance repair']], ['Cleaning', ['House cleaning']], ['Clothing & Tailoring', ['Tailoring']]];
    let added = 0;
    for (const [name, names] of groups) {
      let category = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!category) { category = await api('/categories', { name }); categories.push(category); }
      if (!category.isActive) continue;
      for (const serviceName of names) {
        if (services.some(s => s.name.toLowerCase() === serviceName.toLowerCase())) continue;
        const result = await api('/services', { name: serviceName, category: category.id });
        services.push(result); added++;
      }
    }
    console.log(JSON.stringify({ servicesAdded: added, existingRecordsPreserved: true }));
  } else console.log('Inspection only. Use --apply to add missing demo services through authenticated catalog APIs.');
} catch (error) { console.error(error.message.startsWith('Catalog request failed:') ? error.message : 'Catalog inspection/setup could not finish. Check API connectivity and local operator setup.'); console.log(JSON.stringify({ errorType: error.name, networkCode: /^[A-Z_]+$/.test(error.cause?.code || '') ? error.cause.code : undefined })); process.exitCode = 1; }
