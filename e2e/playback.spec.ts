import { expect, test } from '@playwright/test';

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin-password-1234';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/sign-in');
  await page.getByLabel('EMAIL').fill(EMAIL);
  await page.getByLabel('PASSWORD').fill(PASSWORD);
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  await page.waitForURL('**/library');
}

test('sign in, play a track, and keep playing across navigation', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await signIn(page);

  // The library renders the seeded tracks.
  const rows = page.locator('ol li[data-playing]');
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  const rowCount = await rows.count();
  console.log(`  library rows: ${rowCount}`);
  expect(rowCount).toBeGreaterThan(0);

  // The player panel is hidden while nothing is queued.
  const panel = page.getByRole('region', { name: 'Player' });
  await expect(panel).toBeHidden();

  // Select by video id, not title: titles come from YouTube (or, in a stubbed
  // run, from the stub) and a refresh can rewrite them at any time.
  const REAL_IDS = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0', 'kJQP7kiw5Fk', 'JGwWNGJdvx8'];
  let firstPlayable = page.locator('x-none');
  for (const id of REAL_IDS) {
    const candidate = page.locator(
      `ol li[data-blocked="false"][data-youtube-id="${id}"] button[aria-label^="Play"]`,
    );
    if (await candidate.count()) {
      firstPlayable = candidate.first();
      console.log(`  chose video id: ${id}`);
      break;
    }
  }
  expect(await firstPlayable.count(), 'no seeded real track in the library').toBeGreaterThan(0);
  const label = await firstPlayable.getAttribute('aria-label');
  console.log(`  clicking: ${label}`);
  await firstPlayable.click();

  await expect(panel).toBeVisible({ timeout: 20_000 });

  // Policy: the embed must be at least 200x200 and visible while playing.
  const frame = panel.locator('iframe');
  await expect(frame).toBeVisible({ timeout: 30_000 });
  const box = await frame.boundingBox();
  console.log(`  embed box: ${box?.width}x${box?.height}`);
  expect(box!.width).toBeGreaterThanOrEqual(200);
  expect(box!.height).toBeGreaterThanOrEqual(200);

  // More than half the player visible — required before any auto-advance.
  const inView = await frame.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const visible =
      Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) *
      Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    return visible / (r.width * r.height);
  });
  console.log(`  fraction of player visible: ${(inView * 100).toFixed(0)}%`);
  expect(inView).toBeGreaterThan(0.5);

  // Playback actually advances.
  const progress = panel.getByRole('progressbar', { name: 'Playback position' });
  // Surface a player error immediately rather than waiting out the poll.
  const errText = panel.locator('p[role="status"]');
  if (await errText.count()) console.log(`  player error: ${await errText.first().innerText()}`);
  await expect
    .poll(async () => Number(await progress.getAttribute('aria-valuenow')), {
      timeout: 45_000,
      intervals: [1000],
    })
    .toBeGreaterThan(1);
  const t1 = Number(await progress.getAttribute('aria-valuenow'));
  console.log(`  position after start: ${t1}s`);

  // The critical architectural test: navigate, and confirm the SAME iframe node
  // survives. If the layout remounted it, playback would stop.
  await page.evaluate(() => {
    const el = document.querySelector('section[aria-label="Player"] iframe');
    (el as HTMLElement & { dataset: DOMStringMap }).dataset.probe = 'original';
  });

  await page.getByRole('link', { name: 'QUEUE' }).click().catch(async () => {
    await page.getByRole('link', { name: 'SEARCH' }).click();
  });
  await page.waitForTimeout(3000);

  const stillOriginal = await page.evaluate(
    () =>
      (
        document.querySelector('section[aria-label="Player"] iframe') as
          | (HTMLElement & { dataset: DOMStringMap })
          | null
      )?.dataset.probe === 'original',
  );
  console.log(`  same iframe node after navigation: ${stillOriginal}`);
  expect(stillOriginal, 'the player iframe was remounted by navigation').toBe(true);

  const t2 = Number(await progress.getAttribute('aria-valuenow'));
  console.log(`  position after navigating: ${t2}s`);
  expect(t2, 'playback did not continue across navigation').toBeGreaterThan(t1);

  console.log(`  console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 5)) console.log(`    ${e}`);
});
