import type { Metadata, Viewport } from 'next';

// Self-hosted fonts. `wght.css` is the upright weight axis only — one variable
// woff2 covers 400/500/600 with no italic or width axis shipped. Nothing is
// fetched from fonts.googleapis.com or fonts.gstatic.com at runtime.
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import '@/styles/tokens.css';
import '@/styles/base.css';

export const metadata: Metadata = {
  title: 'Library',
  description: 'A private music player.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0B0C',
  // Required for env(safe-area-inset-bottom) to report anything but 0, which
  // the tab bar's bottom padding depends on.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
