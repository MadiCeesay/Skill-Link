import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.js'], fileParallelism: false, testTimeout: 20000, hookTimeout: 600000, env: { MONGMS_RESUME_DOWNLOAD: 'true' } } });
