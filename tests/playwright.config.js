const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 35000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8383',
    headless: true,
    viewport: { width: 430, height: 900 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx http-server .. -p 8383 --silent',
    url: 'http://127.0.0.1:8383',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
