/**
 * Theme identity, shared by the server (reads the cookie in app/layout.tsx) and
 * the client (writes it from the account menu). Kept framework-free so both
 * sides import the same source of truth.
 */

export type ThemeName = 'current' | 'glass';

/** Cookie name mirrors the mp_session convention. */
export const THEME_COOKIE = 'mp_theme';

/** A brand-new visitor (no cookie yet) lands on Glass — the finalized direction. */
export const DEFAULT_THEME: ThemeName = 'glass';

/** One year. A look-and-feel preference has no reason to expire sooner. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Coerce any untrusted value (cookie, dataset) to a known theme. */
export function normalizeTheme(value: string | undefined | null): ThemeName {
  return value === 'current' || value === 'glass' ? value : DEFAULT_THEME;
}

/**
 * The document.cookie string the client writes when the user switches themes.
 * Pure (no DOM) so it can be unit-tested. Lax is enough: this is a cosmetic
 * preference, not an auth token.
 */
export function serializeThemeCookie(theme: ThemeName): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}
