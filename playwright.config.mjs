// Browser tests exist for one class of defect the other suites cannot see:
// anything decided by layout. Zero-width bands, a flex-basis that becomes a
// height in a column, a media query losing to a more specific selector, a
// heading that overflows only in the fallback font iOS actually uses — all of
// those shipped, and all of them need a real engine to catch.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['iPhone 13'] } },
    { name: 'narrow', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 700 } } }
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --directory public',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI
  }
});
