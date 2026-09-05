import { cookies } from 'next/headers';
import { THEME_COOKIE, normalizeTheme, type ThemeName } from './theme';

/**
 * Resolve the active theme on the server from the mp_theme cookie. Missing or
 * unknown value → the default (glass). Used by server components (e.g. the admin
 * page) that need to pick a Current vs Glass structure before rendering.
 */
export async function getServerTheme(): Promise<ThemeName> {
  const store = await cookies();
  return normalizeTheme(store.get(THEME_COOKIE)?.value);
}
