import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright configuration for ResetBiology.com HOS testing
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Use absolute path resolution from config file location
  testDir: path.resolve(__dirname, 'playwright'),

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: path.resolve(__dirname, 'results/html'), open: 'never' }],
    ['json', { outputFile: path.resolve(__dirname, 'results/results.json') }],
    ['list'],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers and devices */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Web server config - reuse existing server at localhost:3000 */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
