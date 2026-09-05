import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { THEME_COOKIE, normalizeTheme } from '@/lib/theme/theme';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';

// Self-hosted fonts. `wght.css` is the upright weight axis only — one variable
// woff2 covers 400/500/600 with no italic or width axis shipped. Nothing is
// fetched from fonts.googleapis.com or fonts.gstatic.com at runtime.
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

// Glass theme faces. Only referenced by [data-theme='glass'] type tokens, so the
// Current theme is unaffected. Self-hosted (no runtime fetch), matching the above.
import '@fontsource-variable/manrope/wght.css'; // UI — variable 400–700 upright
import '@fontsource/instrument-serif/400.css'; // display/marketing voice
import '@fontsource/jetbrains-mono/400.css'; // numerals + labels
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';

import '@/styles/tokens.css';
import '@/styles/base.css';

export const metadata: Metadata = {
  title: 'Music Player',
  description: 'A private index over the slice of YouTube I actually listen to.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Player' },
  icons: {
    icon: [{ url: '/favicon.png', sizes: '48x48', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0B0C',
  // Required for env(safe-area-inset-bottom) to report anything but 0, which
  // the tab bar's bottom padding depends on.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Decided on the server from the cookie, so the correct theme paints on the
  // first frame — no flash, no blocking inline script. Missing cookie → Glass.
  const store = await cookies();
  const theme = normalizeTheme(store.get(THEME_COOKIE)?.value);

  return (
    <html lang="en" data-theme={theme} style={{ colorScheme: 'dark' }}>
      <body>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
