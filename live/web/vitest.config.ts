import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Ujian web (DOM).
 *
 * Berasingan daripada harness root: di sini semua dependensi - React,
 * react-dom, testing-library - Install dalam `live/web/node_modules`, jadi
 * hanya satu salinan React. Dua salinan akan pecahkan hooks.
 *
 * Fail DOM memasang `// @vitest-environment jsdom` di baris pertama.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared'),
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: false,
    restoreMocks: true,
  },
});
