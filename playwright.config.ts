import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build served by scripts/preview-server.mjs (one origin:
 * marketing at /, app at /app/). Run `pnpm build` first; the webServer below only serves.
 */
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
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    acceptDownloads: true,
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
    {
      name: 'desktop',
      testIgnore: [/a11y\.spec\.ts/, /mobile\.spec\.ts/],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'a11y',
      testMatch: /a11y\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    { name: 'mobile', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    { name: 'viewports-chromium', testMatch: /viewports\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'viewports-webkit', testMatch: /viewports\.spec\.ts/, use: { ...devices['Desktop Safari'] } },
    { name: 'viewports-firefox', testMatch: /viewports\.spec\.ts/, use: { ...devices['Desktop Firefox'] } },
    {
      name: 'journeys-webkit',
      testMatch: /(public|journeys)\.spec\.ts/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'journeys-firefox',
      testMatch: /(public|journeys)\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'node scripts/preview-server.mjs',
    port: 4173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
