'use client';

import { useEffect } from 'react';
import { averageColor, glowCss } from './extractColor';

/**
 * Sets the CSS variable --art-glow on <html> to a colour sampled from the
 * current track's artwork, so the Glass theme's ambient glow shifts per song.
 *
 * It runs in every theme (the variable is simply unused in the current theme),
 * which keeps it correct across a live theme switch with no reactive plumbing.
 * On any failure — no artwork, a CORS-tainted canvas, a decode error — it clears
 * the variable and the ambient layer falls back to its preset gradient. A
 * missing image degrades to a nice static glow, never a broken screen.
 */
export function useArtGlow(thumbnailUrl: string | null | undefined): void {
  useEffect(() => {
    const root = document.documentElement;
    if (!thumbnailUrl) {
      root.style.removeProperty('--art-glow');
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 16; // Tiny: we only need an average, not the image.
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const css = glowCss(averageColor(data));
        if (css) root.style.setProperty('--art-glow', css);
        else root.style.removeProperty('--art-glow');
      } catch {
        // Tainted canvas (CORS) or any read failure → preset gradient.
        root.style.removeProperty('--art-glow');
      }
    };
    img.onerror = () => {
      if (!cancelled) root.style.removeProperty('--art-glow');
    };
    img.src = thumbnailUrl;

    return () => {
      cancelled = true;
    };
  }, [thumbnailUrl]);
}
