'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_THEME, type ThemeName } from './theme';

const ThemeContext = createContext<ThemeName>(DEFAULT_THEME);

/**
 * Makes the server-resolved theme readable by client components so they can
 * branch structure (`theme === 'glass' ? <GlassX/> : <X/>`). The value is stable
 * for the render: switching themes writes the cookie and calls router.refresh(),
 * which re-runs the server and re-seeds this provider — no client mutation needed.
 */
export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeName;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeName {
  return useContext(ThemeContext);
}
