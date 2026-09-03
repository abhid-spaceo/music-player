/**
 * Pure play-recording rule. Kept free of imports so it stays unit-testable in
 * node:test — the actual POST happens in PlayerProvider via apiSend().
 */

/** True when a play should be recorded: only when the track actually changed. */
export function shouldRecordPlay(lastTrackId: string | null, trackId: string): boolean {
  return lastTrackId !== trackId;
}
