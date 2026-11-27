import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Test harness monorepo.
 *
 * Unit test web (React) perlukan DOM, jadi fail web MEMASANG sendiri
 * `// @vitest-environment jsdom` di baris pertama - cara itu stabil
 *across versi vitest, tidak bergantung pada `environmentMatchGlobs`
 * yang sudah tidak disokong.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Satu salinan React sahaja. Tanpa ini, komponen (menyelesai 'react'
    // dari live/web/node_modules) dan testing-library (dari root) akan guna
    // dua instance berbeza - hooks akan pecah, dan recharts akan gagal
    // membaca context.
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^react$/, replacement: resolve(__dirname, 'live/web/node_modules/react/index.js') },
      { find: /^react\/(.*)$/, replacement: resolve(__dirname, 'live/web/node_modules/react') + '/$1' },
      { find: /^react-dom$/, replacement: resolve(__dirname, 'live/web/node_modules/react-dom/index.js') },
      { find: /^react-dom\/(.*)$/, replacement: resolve(__dirname, 'live/web/node_modules/react-dom') + '/$1' },
      { find: '@shared', replacement: resolve(__dirname, 'packages/shared') },
      { find: '@', replacement: resolve(__dirname, 'live/web/src') },
    ],
  },
  test: {
    environment: 'node',
    // Ujian DOM web TIDAK di sini - ia berjalan dalam live/web (satu
    // punca React). Harness ini untuk logik tulen: shared + pages.
    include: ['packages/shared/tests/**/*.test.ts', 'live/pages/tests/**/*.test.ts'],
    globals: false,
    restoreMocks: true,
    // Pakej CJS (testing-library, recharts) mesti diproses oleh Vite,
    // bukan dimuat terus oleh Node - kalau tidak, 'react-dom' akan
    // diselesaikan dari node_modules root dan ada dua instance React.
    server: {
      deps: {
        inline: [/@testing-library\//, /recharts/, /react-dom/, 'react'],
      },
    },
  },
});
