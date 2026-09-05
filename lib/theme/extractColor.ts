/**
 * Pure colour maths for the album-art glow (Glass theme). No DOM, no network —
 * so it is unit-testable in isolation. The hook in useArtGlow.ts feeds it the
 * raw pixels from a tiny canvas and turns the result into a CSS glow colour.
 */

export type RGB = { r: number; g: number; b: number };

/**
 * Average the visible pixels of an RGBA buffer (canvas getImageData order).
 * `step` samples every Nth pixel for speed. Returns null when there is nothing
 * usable (empty buffer, or every pixel effectively transparent) — the caller
 * then falls back to the preset gradient rather than showing a wrong colour.
 */
export function averageColor(data: Uint8ClampedArray, step = 1): RGB | null {
  if (!data || data.length < 4) return null;

  const stride = 4 * Math.max(1, Math.floor(step));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i + 3 < data.length; i += stride) {
    // Skip near-transparent pixels; they carry no meaningful colour.
    if (data[i + 3]! < 125) continue;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    count += 1;
  }

  if (count === 0) return null;
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

/**
 * Turn an average colour into the CSS value the ambient glow layer consumes.
 * Alpha is fixed so the glow reads as light, not a flat fill. Null in → null out
 * so the caller can clear the variable and let the preset gradient show.
 */
export function glowCss(rgb: RGB | null): string | null {
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`;
}
