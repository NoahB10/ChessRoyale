import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // online.spec.ts needs the Worker/DO (run via playwright.online.config.ts).
  testIgnore: 'online.spec.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
