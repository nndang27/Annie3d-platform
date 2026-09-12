import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) } },
  test: {
    include: ['packages/**/*.test.ts', 'apps/web/src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    setupFiles: ['./tests/vitest.setup.ts'],
    testTimeout: 15000,
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'test-results/vitest-junit.xml' },
  },
});
