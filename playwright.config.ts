import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const API_PORT = 8788;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E runs against a real production build so the shipped bundle is what gets
 * tested. The debug bridge is enabled explicitly for the test build only.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      // Headless Chromium needs SwiftShader to provide a WebGL context.
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-lcd-text',
      ],
    },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  // Two processes: the API and the static preview of the production build.
  // The preview proxies /api to the server, so the browser stays same-origin.
  webServer: [
    {
      command: 'node server/src/index.ts',
      url: `http://127.0.0.1:${String(API_PORT)}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        STORAGE_DRIVER: 'sqlite',
        SQLITE_PATH: './data/e2e.db',
        PLAYER_TOKEN_PEPPER: 'e2e-pepper-value-that-is-long-enough-32',
      },
    },
    {
      command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_ENABLE_GAME_DEBUG: 'true',
        API_PROXY_TARGET: `http://127.0.0.1:${String(API_PORT)}`,
      },
    },
  ],
});
