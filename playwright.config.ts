import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  expect: {
    timeout: 10000,
  },
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'smoke',
      testDir: './tests/smoke',
      use: {
        ...devices['Desktop Chrome'],
        env: {
          VITE_PREVIEW_PASSWORD: 'test-preview-password',
        }
      },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'export VITE_PREVIEW_PASSWORD=test-preview-password && npm run build:frontend && npm run preview --workspace=frontend',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      env: {
        VITE_PREVIEW_PASSWORD: 'test-preview-password',
        VITE_API_URL: 'http://localhost:8787',
      }
    },
    {
      command: 'cd backend && npx wrangler dev --persist-to ../.wrangler/state/v3 --var E2E_TEST:true --var E2E_TEST_TOKEN:test-token-123 --var AUTH_TOKEN_SECRET:test-auth-token-secret-must-be-32-chars-long --var AI_API_KEY:test-ai-key --var R2_PROXY_DOMAIN:""',
      port: 8787,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        E2E_TEST: 'true',
        E2E_TEST_TOKEN: 'test-token-123',
        AI_API_KEY: 'test-ai-key', // Ensure backend has a key for built-in provider
        AUTH_TOKEN_SECRET: 'test-auth-token-secret-must-be-32-chars-long',
        CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
      }
    }
  ],
});
