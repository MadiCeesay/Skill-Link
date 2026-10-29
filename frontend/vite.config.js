import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localOriginRedirect } from './scripts/local-origin.js';
export default defineConfig({
  plugins: [react(), {
    name: 'skilllink-local-origin',
    configureServer(server) {
      server.middlewares.use(localOriginRedirect(server.config.server.port));
    },
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
  build: { sourcemap: false },
});
