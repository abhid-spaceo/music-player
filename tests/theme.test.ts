import assert from 'node:assert/strict';
import { test } from 'node:test';
import { averageColor, glowCss } from '../lib/theme/extractColor';
import { normalizeTheme, serializeThemeCookie, THEME_COOKIE } from '../lib/theme/theme';

// --- averageColor --------------------------------------------------------

test('averageColor returns null for an empty buffer', () => {
  assert.equal(averageColor(new Uint8ClampedArray(0)), null);
});

test('averageColor returns null when every pixel is transparent', () => {
  // Two opaque-looking RGB triples but alpha 0 → skipped → nothing to average.
  const data = new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 0]);
  assert.equal(averageColor(data), null);
});

test('averageColor averages only the visible pixels', () => {
  // Red (opaque) + blue (opaque) + green (transparent, must be ignored).
  const data = new Uint8ClampedArray([
    200, 0, 0, 255,
    0, 0, 200, 255,
    0, 255, 0, 0,
  ]);
  assert.deepEqual(averageColor(data), { r: 100, g: 0, b: 100 });
});

// --- glowCss -------------------------------------------------------------

test('glowCss returns null when there is no colour (preset fallback)', () => {
  assert.equal(glowCss(null), null);
});

test('glowCss builds a translucent rgba string', () => {
  assert.equal(glowCss({ r: 10, g: 20, b: 30 }), 'rgba(10, 20, 30, 0.55)');
});

// --- theme helpers -------------------------------------------------------

test('normalizeTheme accepts known values and defaults everything else to glass', () => {
  assert.equal(normalizeTheme('current'), 'current');
  assert.equal(normalizeTheme('glass'), 'glass');
  assert.equal(normalizeTheme(undefined), 'glass');
  assert.equal(normalizeTheme(''), 'glass');
  assert.equal(normalizeTheme('neo-brutalism'), 'glass');
});

test('serializeThemeCookie writes a path-wide, year-long, lax cookie', () => {
  const c = serializeThemeCookie('current');
  assert.ok(c.startsWith(`${THEME_COOKIE}=current`));
  assert.match(c, /path=\//);
  assert.match(c, /max-age=31536000/);
  assert.match(c, /samesite=lax/i);
});
