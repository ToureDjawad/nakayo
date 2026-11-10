import { defineConfig, devices } from '@playwright/test'

const ci = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Permet d'utiliser un Chromium déjà installé (PLAYWRIGHT_CHROMIUM_PATH)
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: [
    {
      command: 'npm run start -w @nakayo/server',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !ci,
    },
    {
      command: 'npm run dev -w @nakayo/client',
      url: 'http://localhost:5173',
      reuseExistingServer: !ci,
    },
  ],
})
