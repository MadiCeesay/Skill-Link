import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    browserName: 'chromium',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
    ...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
      ? { channel: 'chrome' }
      : {}),
  },
  webServer: [
    {
      command: 'node tests/live-server.mjs',
      url: 'http://127.0.0.1:5001/api/ready',
      reuseExistingServer: false,
      timeout: 180000,
    },
    {
      command: 'node tests/preview-server.mjs',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
