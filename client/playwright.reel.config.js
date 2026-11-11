// Parcours du front sur la vraie API, hors CI : voir tests/reel/README.md.
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/reel',
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5180', ...devices['Desktop Chrome'], trace: 'off' },
})
