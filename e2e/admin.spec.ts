import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin-password-1234';
const LISTENER_EMAIL = process.env.SEED_LISTENER_EMAIL ?? 'listener@example.com';
const LISTENER_PASSWORD = process.env.SEED_LISTENER_PASSWORD ?? 'listener-password-1234';

async function signIn(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/sign-in');
  await page.getByLabel('EMAIL').fill(email);
  await page.getByLabel('PASSWORD').fill(password);
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  await page.waitForURL('**/library');
  // The dev-only Next.js overlay renders above the tab bar and swallows clicks
  // on it. It does not exist in a production build, so hiding it here tests the
  // real thing rather than working around a bug in our own markup.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
}

test('admin: the nav link is visible to an admin and reaches the screen', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  const link = page.getByRole('link', { name: 'ADMIN' }).first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'ADD LINKS' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'TRACKS' })).toBeVisible();
});

test('admin: a listener never sees the nav link', async ({ page }) => {
  await signIn(page, LISTENER_EMAIL, LISTENER_PASSWORD);
  await expect(page.getByRole('link', { name: 'ADMIN' })).toHaveCount(0);
});

test('admin: pasting links reports one outcome per link', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');

  // A well-formed id that does not exist on YouTube, a duplicate of a seeded
  // track, and something that is not a link at all — one of each outcome.
  const ghost = `ADDTEST${String(Date.now()).slice(-4)}`;
  await page.getByLabel('YouTube links').fill(
    [`https://youtu.be/${ghost}`, 'https://youtu.be/dQw4w9WgXcQ', 'not-a-link'].join('\n'),
  );
  await page.getByRole('button', { name: 'ADD LINKS' }).click();

  const results = page.getByRole('list', { name: 'Results' });
  await expect(results).toBeVisible({ timeout: 30_000 });
  await expect(results.getByText('DUPLICATE')).toBeVisible();
  await expect(results.getByText('INVALID')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('quota');
});

test('admin: the track table lists and filters the library', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'TRACKS' }).click();

  const rows = page.getByRole('list', { name: 'Tracks' }).getByRole('listitem');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  expect(await rows.count()).toBeGreaterThan(1);

  await page.getByLabel('Search tracks').fill('Never Gonna');
  await expect(rows).toHaveCount(1, { timeout: 15_000 });
  await expect(rows.first()).toContainText('Never Gonna Give You Up');
});

test('admin: editing a sort artist persists across a reload', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'TRACKS' }).click();
  await page.getByLabel('Search tracks').fill('Never Gonna');

  const rows = page.getByRole('list', { name: 'Tracks' }).getByRole('listitem');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  const value = `Astley ${String(Date.now()).slice(-5)}`;
  await rows.first().getByRole('button', { name: /^Edit / }).click();
  await page.getByLabel('Sort artist').fill(value);
  await page.getByRole('button', { name: 'SAVE' }).click();
  await expect(rows.first()).toContainText(value, { timeout: 15_000 });

  await page.reload();
  await page.getByRole('tab', { name: 'TRACKS' }).click();
  await page.getByLabel('Search tracks').fill('Never Gonna');
  await expect(rows.first()).toContainText(value, { timeout: 15_000 });
});

test('admin: the dead-link check reports how many it re-checked', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'TRACKS' }).click();
  await page.getByRole('button', { name: 'CHECK FOR DEAD LINKS' }).click();
  await expect(page.getByTestId('check-result')).toContainText('re-checked', {
    timeout: 30_000,
  });
});

test('admin: a YouTube Mix link is refused with a reason, not a silent failure', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');

  // A Mix (list=RD…) is generated per viewer and the Data API will not serve
  // it. Chosen deliberately: it exercises the playlist path without spending
  // quota or adding rows.
  await page.getByLabel('YouTube links').fill(
    'https://www.youtube.com/playlist?list=RDdQw4w9WgXcQ',
  );
  await page.getByRole('button', { name: 'ADD LINKS' }).click();

  const results = page.getByRole('list', { name: 'Results' });
  await expect(results).toBeVisible({ timeout: 30_000 });
  await expect(results.getByText('INVALID')).toBeVisible();
  await expect(results).toContainText('Mixes');
  await expect(page.getByRole('status')).toContainText('0 quota units spent');
});
