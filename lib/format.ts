/** M:SS, or H:MM:SS once past an hour. Seconds are always two digits. */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** Decimal MB/GB, matching how Vercel and Neon meter storage. */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

/** "16 TRACKS · 8 OFFLINE" — U+00B7, spaced, as the canvas has it. */
export function formatLibraryMeta(trackCount: number, downloadedCount: number): string {
  return `${trackCount} TRACKS · ${downloadedCount} OFFLINE`;
}
