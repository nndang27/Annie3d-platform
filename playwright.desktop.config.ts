import { defineConfig } from '@playwright/test';

/** Desktop app tests: the Electron shell against a fake site (tests/desktop/site.ts). */
export default defineConfig({
  testDir: 'tests/desktop',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/desktop',
});
