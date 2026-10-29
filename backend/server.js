import { createServer } from 'node:http';
import { attachSocket } from './src/realtime/socket.js';
import { loadConfig } from './src/config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from './src/config/database.js';
import { createApp } from './src/app.js';
let server, io;
let stopping = false;
async function shutdown(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  console.info('Shutting down:', signal);
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    if (io) await new Promise(resolve => io.close(resolve));
    if (server?.listening) await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    await disconnectDatabase();
    clearTimeout(deadline);
    process.exitCode = exitCode;
  } catch { process.exitCode = 1; }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
try {
  const config = loadConfig();
  const app = createApp(config);
  await connectDatabase(config.MONGODB_URI);
  await ensureIndexes();
  if (!stopping) {
    server = createServer(app);
    io = attachSocket(server, app, config);
    server.listen(config.PORT, () => console.info('SkillLink API listening on port', config.PORT));
    server.on('error', () => shutdown('HTTP server error', 1));
  }
} catch (error) {
  // Configuration errors list field names only; driver errors may contain credentials.
  console.error(error.message.startsWith('Invalid environment') || error.message.startsWith('JWT ') || error.message.startsWith('Access lifetime') || error.message.startsWith('Production frontend') ? error.message : 'Startup failed: check database connectivity and configuration');
  await shutdown('startup failure', 1);
}
