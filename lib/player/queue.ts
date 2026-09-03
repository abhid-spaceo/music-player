/** Pure helpers for the in-memory playback queue. No React, no side effects. */

/** Move the item at `from` to `to`. Returns a new array; no-op if out of range. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to) return list.slice();
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list.slice();
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** Remove the item at `at`. Returns a new array; no-op if out of range. */
export function removeAt<T>(list: readonly T[], at: number): T[] {
  if (at < 0 || at >= list.length) return list.slice();
  const next = list.slice();
  next.splice(at, 1);
  return next;
}

/**
 * New `index` after removing `removed` from the queue, keeping the *current*
 * track stable. Removing the current index keeps the number so the next track
 * slides into the slot.
 */
export function indexAfterRemove(current: number, removed: number): number {
  if (removed < current) return current - 1;
  return current;
}
