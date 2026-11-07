import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5192',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node test/ui-server.mjs',
    url: 'http://127.0.0.1:5192',
    reuseExistingServer: false,
  },
})
