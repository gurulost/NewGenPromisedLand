import { defineConfig, devices } from '@playwright/test';

const appPort = Number(process.env.PLAYWRIGHT_APP_PORT ?? 5100);
const appBaseUrl = `http://localhost:${appPort}`;

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  
  use: {
    baseURL: appBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: `${appBaseUrl}/__health`,
    env: {
      ...process.env,
      PORT: String(appPort),
      REUSE_PORT: 'false',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://codex:codex@127.0.0.1:5432/codex',
      DISABLE_SAVE_API: 'true',
    },
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
