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
  // Timeouts sized for a busy machine, not an idle one.
  //
  // Almost everything this suite asserts is progressive enhancement: the tooltip,
  // the reader settings, the copy menu, the keyboard announcer. None of it can
  // respond until the client bundle has hydrated, so every such test is really a
  // race between the interaction and hydration. Playwright's defaults (30s per
  // test, 5s per assertion) win that race on an idle laptop and lose it under
  // load — the observed symptom was one to four *different* tests timing out on
  // each full run, with zero actual assertion failures among them, which reads as
  // a broken suite rather than a slow one. A two-core CI runner is the loaded
  // case, permanently.
  //
  // These are ceilings, not waits: a passing test still finishes as fast as it
  // ever did, and a genuinely broken one still fails.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
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
      // Render across viewports, plus the tooltip's coarse-pointer (bottom-sheet)
      // path, which only exists on a touch device.
      testMatch: /(render|tooltip)\.spec\.ts/,
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
