import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'workers/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    testTimeout: 10000,
    fileParallelism: false,
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'tests/**',
        'workers/**/*.test.ts',
        '**/*.config.ts',
        '**/*.d.ts',
        'next.config.mjs',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/',
    },
  },
});
