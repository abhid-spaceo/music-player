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

test('playlist: create, add, reorder, and the order survives a reload', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'PLAYLISTS' }).click();

  const name = `Test ${Date.now()}`;
  await page.getByLabel('New playlist name').fill(name);
  await page.getByRole('button', { name: 'Create playlist' }).click();

  const link = page.getByRole('link', { name });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await link.click();

  // Add three tracks by searching the library.
  const search = page.getByLabel('Search the library to add a track');
  // One row per track in the playlist; each carries a "Move … down" button.
  const rows = page.locator('ol li button[aria-label*=" down"]');

  const wanted = [
    ['zoo', 'Me at the zoo'],
    ['Never', 'Never Gonna Give You Up'],
    ['Gangnam', 'Gangnam Style'],
  ] as const;

  for (let i = 0; i < wanted.length; i++) {
    const [term, title] = wanted[i]!;
    await search.fill(term);
    const add = page.getByRole('button', { name: `Add ${title} to this playlist` });
    await add.waitFor({ state: 'visible', timeout: 15_000 });
    await add.click();
    // Assert the add actually landed rather than sleeping and hoping.
    await expect(rows).toHaveCount(i + 1, { timeout: 15_000 });
  }

  const titles = () =>
    page.locator('ol li button[aria-label^="Move"][aria-label*="down"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label')!.replace('Move ', '').replace(' down', '')),
    );

  const before = await titles();
  console.log(`  order before: ${before.join(' | ')}`);
  expect(before.length).toBe(3);

  // Move the last track to the top using the accessible controls (which is what
  // works on touch and with a keyboard; drag is desktop-only).
  const last = before[2]!;
  await page.getByRole('button', { name: `Move ${last} up` }).click();
  await expect.poll(async () => (await titles())[1], { timeout: 10_000 }).toBe(last);
  await page.getByRole('button', { name: `Move ${last} up` }).click();
  await expect.poll(async () => (await titles())[0], { timeout: 10_000 }).toBe(last);

  const after = await titles();
  console.log(`  order after:  ${after.join(' | ')}`);
  expect(after[0]).toBe(last);

  // The real assertion: it persisted server-side, not just in local state.
  await page.reload();
  // The list has to be rendered before it can be compared.
  await expect(page.locator('ol li button[aria-label*=" down"]')).toHaveCount(3, {
    timeout: 15_000,
  });
  const reloaded = await titles();
  console.log(`  after reload: ${reloaded.join(' | ')}`);
  expect(reloaded).toEqual(after);

  // Clean up.
  await page.getByRole('link', { name: 'PLAYLISTS' }).click();
  await page.getByRole('button', { name: `Delete playlist ${name}` }).click();
  await expect(page.getByRole('link', { name })).toHaveCount(0, { timeout: 10_000 });
});

test('favourites toggle and survive a reload', async ({ page }) => {
  await signIn(page);

  const heart = page.locator('ol li button[aria-label^="Add"][aria-label*="favourites"]').first();
  await heart.waitFor({ state: 'visible', timeout: 20_000 });
  const label = await heart.getAttribute('aria-label');
  console.log(`  favouriting: ${label}`);
  await heart.click();
  // The button flips to "Remove …" once the favourite is recorded.
  await expect(
    page.locator('ol li button[aria-label^="Remove"][aria-label*="favourites"]'),
  ).toHaveCount(1, { timeout: 10_000 });

  await page.reload();
  await page.getByRole('button', { name: 'FAVES' }).click();
  await expect(page.locator('ol li[data-youtube-id]').first()).toBeVisible({ timeout: 15_000 });

  const faves = await page.locator('ol li[data-youtube-id]').count();
  console.log(`  favourites listed: ${faves}`);
  expect(faves).toBeGreaterThan(0);

  // Undo so the test is repeatable.
  const filled = page.locator('ol li button[aria-label^="Remove"][aria-label*="favourites"]').first();
  await filled.click();
  await expect(
    page.locator('ol li button[aria-label^="Remove"][aria-label*="favourites"]'),
  ).toHaveCount(0, { timeout: 10_000 });
});

test('search cancels superseded requests', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'SEARCH' }).click();

  const requests: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/tracks?') && u.includes('q=')) requests.push(new URL(u).searchParams.get('q')!);
  });

  // Type fast. Debounce plus abort should mean far fewer requests than keystrokes.
  const box = page.getByLabel('Search your library');
  for (const ch of 'gangnam') {
    await box.press(ch);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(1500);

  console.log(`  keystrokes: 7, search requests issued: ${requests.length} (${requests.join(', ')})`);
  expect(requests.length).toBeLessThan(7);
  expect(requests[requests.length - 1]).toBe('gangnam');

  await expect(page.locator('ol li[data-youtube-id]').first()).toBeVisible({ timeout: 15_000 });
  console.log(`  results for "gangnam": ${await page.locator('ol li[data-youtube-id]').count()}`);
});
