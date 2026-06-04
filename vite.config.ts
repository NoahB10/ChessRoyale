import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// `base` is only applied for production builds. It defaults to the GitHub Pages
// project path (/ChessRoyale/) but can be overridden via BASE_PATH — e.g.
// `BASE_PATH=/ npm run build` for a root-level Cloudflare Pages subdomain.
// Dev + e2e always stay at '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.BASE_PATH ?? '/ChessRoyale/') : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}));
