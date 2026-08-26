import { expect, test } from '@playwright/test';

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin-password-1234';

/** "Me at the zoo" is 19 seconds, so a real ENDED event arrives quickly. */
const SHORT_VIDEO = 'jNQXAC9IVRw';

test('the queue auto-advances on ENDED', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('EMAIL').fill(EMAIL);
  await page.getByLabel('PASSWORD').fill(PASSWORD);
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  await page.waitForURL('**/library');

  const rows = page.locator('ol li[data-youtube-id]');
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });

  // Sort A–Z so the short track is not last: the library's default order is
  // added_at DESC, which puts the first-seeded track at the end of the queue,
  // where "auto-advance" correctly has nowhere to go.
  await page.getByRole('button', { name: 'A–Z' }).click();
  await page.waitForTimeout(300);

  const order = await page.locator('ol li[data-youtube-id]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-youtube-id')),
  );
  console.log(`  queue order: ${order.join(', ')}`);
  const startPos = order.indexOf(SHORT_VIDEO);
  expect(startPos, `${SHORT_VIDEO} missing`).toBeGreaterThanOrEqual(0);
  expect(startPos, 'short track is last, so there is nothing to advance to')
    .toBeLessThan(order.length - 1);
  const expectedNext = order[startPos + 1];
  console.log(`  expecting advance to: ${expectedNext}`);

  const start = page.locator(
    `ol li[data-blocked="false"][data-youtube-id="${SHORT_VIDEO}"] button[aria-label^="Play"]`,
  );
  expect(await start.count(), `seed track ${SHORT_VIDEO} is missing`).toBeGreaterThan(0);
  await start.first().click();

  const panel = page.getByRole('region', { name: 'Player' });
  await expect(panel.locator('iframe')).toBeVisible({ timeout: 30_000 });

  // Which row is marked as playing right now?
  const playingId = async () =>
    page.locator('ol li[data-playing="true"]').first().getAttribute('data-youtube-id');

  await expect.poll(playingId, { timeout: 30_000 }).toBe(SHORT_VIDEO);
  console.log(`  started on: ${await playingId()}`);

  // Wait out the 19 seconds and confirm the player moved on by itself. No
  // click, no keypress — this is the programmatic advance that mobile autoplay
  // policies make fragile.
  await expect
    .poll(playingId, { timeout: 75_000, intervals: [2000] })
    .toBe(expectedNext);
  console.log(`  auto-advanced to: ${await playingId()}`);

  // And it is genuinely playing, not just selected.
  const progress = panel.getByRole('progressbar', { name: 'Playback position' });
  await expect
    .poll(async () => Number(await progress.getAttribute('aria-valuenow')), {
      timeout: 30_000,
      intervals: [1000],
    })
    .toBeGreaterThan(0);
  console.log(`  position on the new track: ${await progress.getAttribute('aria-valuenow')}s`);
});
