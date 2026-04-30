import { defineConfig, devices } from '@playwright/test';

delete process.env.NO_COLOR;

const parseAppPort = (value: string | undefined) => {
  if (value == null || value.trim() === '') return 5100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`PLAYWRIGHT_APP_PORT must be a positive integer, received: ${value}`);
  }
  return parsed;
};

const parseWorkers = (value: string | undefined) => {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`PLAYWRIGHT_WORKERS must be a positive integer, received: ${value}`);
  }
  return parsed;
};

const appPort = parseAppPort(process.env.PLAYWRIGHT_APP_PORT);
const appBaseUrl = `http://localhost:${appPort}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === 'true';
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === 'true';
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? 'npm run dev:e2e';
const webServerReadyUrl = process.env.PLAYWRIGHT_WEB_SERVER_READY_URL ?? appBaseUrl;
const runFullMatrix = process.env.PLAYWRIGHT_FULL_MATRIX === 'true';
const configuredWorkers = parseWorkers(process.env.PLAYWRIGHT_WORKERS);

const desktopChromiumProject = {
  name: 'chromium',
  use: { ...devices['Desktop Chrome'] },
};

const fullProjectMatrix = [
  desktopChromiumProject,
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
  },
];

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: configuredWorkers ?? (process.env.CI ? 1 : undefined),
  reporter: process.env.CI ? 'html' : 'list',
  
  use: {
    baseURL: appBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'off' : 'retain-on-failure'
  },

  projects: process.env.CI && !runFullMatrix ? [desktopChromiumProject] : fullProjectMatrix,

  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: webServerCommand,
          url: webServerReadyUrl,
          env: {
            ...process.env,
            PORT: String(appPort),
            REUSE_PORT: 'false',
            DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://codex:codex@127.0.0.1:5432/codex',
            DISABLE_SAVE_API: 'true',
            DISABLE_VITE_RUNTIME_ERROR_OVERLAY: 'true',
            VITE_E2E_MINIMAL_GAME_STAGE: process.env.CI ? 'true' : 'false',
          },
          reuseExistingServer,
          timeout: 120 * 1000,
        },
      }),
});
