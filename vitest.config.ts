import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    pool: 'forks',
    fileParallelism: false, // Run test files sequentially to avoid concurrent file lock issues
    // @ts-ignore
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    exclude: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'prisma/**',
      'tests/**', // Exclude Playwright E2E tests from Vitest
      '**/*.spec.ts', // Exclude Playwright E2E specs
      'vitest.config.ts',
      'vitest.setup.ts',
      'playwright.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'dist/**',
        'prisma/**',
        'tests/**',
        'vitest.config.ts',
        'vitest.setup.ts',
        'playwright.config.ts',
      ],
    },
  },
});
