import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './app/tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'python3 app/serve.py',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
