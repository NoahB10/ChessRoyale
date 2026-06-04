import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// `base` is only applied for production builds so the app works under the
// GitHub Pages project path (/ChessRoyale/) while dev + e2e stay at '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ChessRoyale/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}));
