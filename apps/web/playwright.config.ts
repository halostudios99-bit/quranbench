import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Render tests run across light/dark × desktop/mobile. Accessibility, no-JS and
// action tests run once (desktop-light) — they are orientation-independent.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'off',
  },
  projects: [
    {
      name: 'desktop-light',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'desktop-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
      testMatch: /render\.spec\.ts/,
    },
    {
      name: 'mobile-light',
      use: { ...devices['Pixel 5'], colorScheme: 'light' },
      testMatch: /render\.spec\.ts/,
    },
    {
      name: 'mobile-dark',
      use: { ...devices['Pixel 5'], colorScheme: 'dark' },
      testMatch: /render\.spec\.ts/,
    },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
