import { defineConfig } from '@playwright/test';

// Online multiplayer needs the Worker + Durable Object, which `vite dev` does not
// serve. `wrangler dev` runs them locally (miniflare, no Cloudflare auth needed)
// and serves the built SPA. Built with BASE_PATH=/ so assets resolve at the root.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'online.spec.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: { baseURL: 'http://localhost:8787' },
  webServer: {
    command: 'npm run build && npx wrangler dev --port 8787',
    url: 'http://localhost:8787',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { BASE_PATH: '/', CI: '1', WRANGLER_SEND_METRICS: 'false' },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
