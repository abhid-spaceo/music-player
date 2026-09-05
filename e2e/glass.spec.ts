import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin-password-1234';
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3100';

/** Sign in with an explicit theme cookie so each test controls its own look. */
async function signIn(
  page: import('@playwright/test').Page,
  theme: 'glass' | 'current',
) {
  await page.context().addCookies([{ name: 'mp_theme', value: theme, url: BASE_URL }]);
  await page.goto('/sign-in');
  await page.getByLabel('EMAIL').fill(ADMIN_EMAIL);
  await page.getByLabel('PASSWORD').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  await page.waitForURL('**/library');
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
}

test('glass admin: renders the add-links surface and reports outcomes', async ({ page }) => {
  await signIn(page, 'glass');
  await page.goto('/admin');

  // Glass structure — not the Current tabs.
  await expect(page.getByRole('heading', { name: 'Add links' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tracks' })).toHaveAttribute('aria-disabled', 'true');

  // The live "N links detected" counter reacts to the field.
  const ghost = `ADDTEST${String(Date.now()).slice(-4)}`;
  await page
    .getByLabel('YouTube links')
    .fill([`https://youtu.be/${ghost}`, 'https://youtu.be/dQw4w9WgXcQ', 'not-a-link'].join('\n'));
  await expect(page.getByText(/3 LINKS DETECTED/)).toBeVisible();

  await page.getByRole('button', { name: 'Add to library' }).click();

  // Results render as a glass table with a row per outcome.
  const results = page.getByRole('table');
  await expect(results).toBeVisible({ timeout: 30_000 });
  await expect(results.getByText('DUPLICATE')).toBeVisible();
  await expect(results.getByText('INVALID')).toBeVisible();
});

test('glass: the Design toggle flips data-theme and persists across a reload', async ({ page }) => {
  await signIn(page, 'glass');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'glass');

  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitemradio', { name: 'Current' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'current');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'current');
});
