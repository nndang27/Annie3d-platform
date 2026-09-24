import { defineConfig, devices } from '@playwright/test';

/**
 * Canvas E2E runs against the real stack started by scripts/test-e2e.mjs
 * (disposable Neon branch + Worker + SPA on :5191). E2E_BASE overrides the target.
 */
const baseURL = process.env.E2E_BASE ?? 'http://localhost:5191';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/e2e.json' }],
  ],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'webkit',
      testMatch: /(canvas|runs)\.spec\.ts/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox',
      testMatch: /(canvas|runs)\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
