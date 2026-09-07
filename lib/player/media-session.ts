/**
 * Lock-screen and notification media controls.
 *
 * This is what puts the title, artist, artwork and play / pause / next / prev
 * onto a locked phone. It only works for audio the page itself owns — a track
 * playing inside the sealed YouTube iframe has its own session that we cannot
 * reach, so callers apply this to direct-audio tracks only.
 *
 * Every function is a no-op where the API is missing (older browsers, and any
 * page not served over https), so callers never need to check first.
 */

import type { Track } from '@/lib/library/types';

export type MediaSessionActions = {
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
  stop(): void;
  seekTo(seconds: number): void;
  /** Positive skips forward, negative back. */
  seekBy(offset: number): void;
};

function session(): MediaSession | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return null;
  return navigator.mediaSession;
}

export function setMediaMetadata(track: Track): void {
  const ms = session();
  if (!ms || typeof MediaMetadata === 'undefined') return;
  ms.metadata = new MediaMetadata({
    title: track.title,
    artist: track.sortArtist ?? track.channelTitle,
    // A direct track has no YouTube thumbnail, and an empty artwork list is
    // better than a broken image: the OS falls back to its own placeholder.
    artwork: track.thumbnailUrl
      ? [{ src: track.thumbnailUrl, sizes: '480x360', type: 'image/jpeg' }]
      : [],
  });
}

export function setMediaPlaybackState(playing: boolean): void {
  const ms = session();
  if (!ms) return;
  ms.playbackState = playing ? 'playing' : 'paused';
}

/**
 * Feeds the lock screen's scrubber. Bad numbers make it throw, so anything
 * non-finite or out of order is dropped rather than guessed at.
 */
export function setMediaPosition(position: number, duration: number): void {
  const ms = session();
  if (!ms || typeof ms.setPositionState !== 'function') return;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    ms.setPositionState({
      duration,
      position: Math.min(Math.max(0, position), duration),
      playbackRate: 1,
    });
  } catch {
    // A browser that rejects a position update still plays audio.
  }
}

export function attachMediaActions(actions: MediaSessionActions): void {
  const ms = session();
  if (!ms) return;
  const map: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => actions.play()],
    ['pause', () => actions.pause()],
    ['nexttrack', () => actions.next()],
    ['previoustrack', () => actions.previous()],
    ['stop', () => actions.stop()],
    ['seekbackward', (d) => actions.seekBy(-(d.seekOffset ?? 10))],
    ['seekforward', (d) => actions.seekBy(d.seekOffset ?? 10)],
    ['seekto', (d) => (d.seekTime != null ? actions.seekTo(d.seekTime) : undefined)],
  ];
  for (const [action, handler] of map) {
    try {
      ms.setActionHandler(action, handler);
    } catch {
      // Not every browser supports every action; the rest still register.
    }
  }
}

/** Clears the lock screen when playback moves back to a YouTube track. */
export function clearMediaSession(): void {
  const ms = session();
  if (!ms) return;
  ms.metadata = null;
  ms.playbackState = 'none';
}
