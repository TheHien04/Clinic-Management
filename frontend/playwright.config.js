/* eslint-env node */
import { defineConfig, devices } from '@playwright/test';

const env = globalThis?.process?.env || {};
const isCi = Boolean(env.CI);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/login',
    reuseExistingServer: !isCi,
    timeout: 30_000,
  },
  use: {
    baseURL: env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
