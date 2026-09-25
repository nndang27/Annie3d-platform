import { defineConfig } from '@playwright/test';

/** Desktop app against the real stack (scripts/test-stack.mjs): local-first board files. */
export default defineConfig({
  testDir: 'tests/desktop-cloud',
  timeout: 240_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/desktop-cloud',
});
