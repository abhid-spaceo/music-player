/** Pure seek math shared by the mini bar and the Now Playing page. */

export function clampSeconds(seconds: number, total: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(0, seconds), Math.max(0, total));
}

/** ratio is 0..1 across the bar's width. */
export function secondsFromRatio(ratio: number, total: number): number {
  return clampSeconds(ratio * total, total);
}

export function nudge(position: number, delta: number, total: number): number {
  return clampSeconds(position + delta, total);
}
