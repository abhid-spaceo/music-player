import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3100',
    // Real Chrome, not bundled Chromium: YouTube playback needs the
    // proprietary codecs that Chromium ships without.
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
  },
});
