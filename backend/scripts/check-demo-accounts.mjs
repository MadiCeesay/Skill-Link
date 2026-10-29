import { readFile } from 'node:fs/promises';
import { loadConfig } from '../src/config/env.js';
const config = loadConfig();
const accounts = JSON.parse(await readFile(new URL('../.local-integration/accounts.json', import.meta.url), 'utf8'));
for (const role of ['admin', 'customer', 'worker']) {
  try {
    const response = await fetch(`http://localhost:${config.PORT}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: accounts[role].email, password: accounts[role].password }) });
    const body = await response.json();
    console.log(JSON.stringify({ role, status: response.status, code: body.error?.code, signedIn: Boolean(body.success) }));
    if (body.success) await fetch(`http://localhost:${config.PORT}/api/auth/logout`, { method: 'POST', headers: { Authorization: 'Bearer ' + body.data.accessToken } });
    else process.exitCode = 1;
  } catch { console.log(JSON.stringify({ role, reachable: false })); process.exitCode = 1; }
}
