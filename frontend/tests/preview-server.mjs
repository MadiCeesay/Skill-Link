import { createServer } from 'vite';
process.env.VITE_API_URL = 'http://127.0.0.1:5001/api';
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});
await server.listen();
