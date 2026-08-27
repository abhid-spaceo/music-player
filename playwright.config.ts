import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@playwright/test';

// Credentials live in .env.local; the specs read them from process.env.
loadEnv({ path: '.env.local', quiet: true });

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  reporter: [['list']],
  /**
   * One worker, no parallelism. These are integration tests against a single
   * dev server and a single database: they add tracks, create playlists and
   * toggle favourites against shared state. Running the files in parallel makes
   * them race each other, which shows up as intermittent failures that pass in
   * isolation.
   */
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3100',
    // Real Chrome, not bundled Chromium: YouTube playback needs the
    // proprietary codecs that Chromium ships without.
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
  },
});
