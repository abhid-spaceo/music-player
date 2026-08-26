'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  describePlayerError,
  loadIframeApi,
  PLAYER_STATE,
  type YTPlayer,
  type YTPlayerState,
} from '@/lib/youtube/iframe-api';
import type { Track } from '@/lib/library/types';

export type PlaybackError = { reason: string; message: string; trackId: string } | null;

type PlayerApi = {
  /** The ordered queue. Built from a filtered library view or a playlist. */
  queue: Track[];
  index: number;
  current: Track | null;
  playing: boolean;
  /** Seconds. Polled while playing; the API has no timeupdate event. */
  position: number;
  duration: number;
  ready: boolean;
  error: PlaybackError;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';

  playQueue: (tracks: Track[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setShuffle: (on: boolean) => void;
  cycleRepeat: () => void;
  /** Registers the DOM node the iframe is mounted into. */
  registerHost: (node: HTMLDivElement | null) => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<PlaybackError>(null);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');

  const playerRef = useRef<YTPlayer | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const createdRef = useRef(false);
  /**
   * Mobile browsers only honour playVideo() inside a user gesture. The first
   * play must therefore come from a real tap; after that the player is
   * "unlocked" and programmatic advances are allowed.
   */
  const unlockedRef = useRef(false);
  /**
   * A track requested before the IFrame API finished loading. Without this, an
   * early click is silently dropped and nothing ever plays — the player is
   * created asynchronously, so the first tap frequently lands before it exists.
   */
  const pendingRef = useRef<string | null>(null);
  /**
   * `new YT.Player()` returns an object straight away, but its methods do not
   * exist until onReady fires. So a non-null check is NOT a readiness check —
   * calling loadVideoById too early throws "is not a function".
   */
  const readyRef = useRef(false);
  /** Read inside API callbacks, which close over stale state otherwise. */
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(0);
  const repeatRef = useRef<'off' | 'all' | 'one'>('off');

  // Synced in effects, never during render. The IFrame API's callbacks close
  // over whatever these hold at fire time, which is how onStateChange sees the
  // current queue without the player being re-created on every change.
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const advance = useCallback((delta: number, auto: boolean) => {
    const q = queueRef.current;
    if (q.length === 0) return;

    if (auto && repeatRef.current === 'one') {
      playerRef.current?.seekTo(0, true);
      playerRef.current?.playVideo();
      return;
    }

    let nextIndex = indexRef.current + delta;
    if (nextIndex >= q.length) {
      if (repeatRef.current === 'all') nextIndex = 0;
      else {
        setPlaying(false);
        return;
      }
    }
    if (nextIndex < 0) nextIndex = 0;

    const track = q[nextIndex];
    if (!track) return;

    setIndex(nextIndex);
    setError(null);
    // loadVideoById starts playback itself. It is only reached after a
    // user-initiated first play, so the autoplay policy is satisfied.
    if (playerRef.current && readyRef.current) {
      playerRef.current.loadVideoById(track.youtubeId);
    } else {
      pendingRef.current = track.youtubeId;
    }
  }, []);

  const registerHost = useCallback((node: HTMLDivElement | null) => {
    hostRef.current = node;
    if (!node || createdRef.current) return;
    createdRef.current = true;

    loadIframeApi()
      .then((YT) => {
        if (!hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          // nocookie satisfies the policy requirement to turn tracking off for
          // Made For Kids videos, and costs nothing for the rest.
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            // Controls stay on: stripping them is a policy violation.
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              readyRef.current = true;
              setReady(true);
              // Apply a click that arrived before the player existed. The
              // original click is still the user gesture that authorises this.
              const pending = pendingRef.current;
              if (pending) {
                pendingRef.current = null;
                e.target.loadVideoById(pending);
              }
            },
            onStateChange: (e: { data: YTPlayerState; target: YTPlayer }) => {
              const state = e.data;
              setPlaying(state === PLAYER_STATE.PLAYING);
              if (state === PLAYER_STATE.PLAYING) {
                setDuration(e.target.getDuration());
                setError(null);
              }
              if (state === PLAYER_STATE.ENDED) advance(1, true);
            },
            onError: (e: { data: number }) => {
              const described = describePlayerError(e.data);
              const track = queueRef.current[indexRef.current];
              setError({ ...described, trackId: track?.id ?? '' });
              setPlaying(false);
              // A dead entry must not stall the queue. Skip forward, but only
              // when there is somewhere to go.
              if (indexRef.current < queueRef.current.length - 1) {
                setTimeout(() => advance(1, true), 1200);
              }
            },
          },
        });
      })
      .catch((err: unknown) => {
        setError({
          reason: 'api-load',
          message:
            err instanceof Error ? err.message : 'Could not load the YouTube player.',
          trackId: '',
        });
      });
  }, [advance]);

  // The API exposes no timeupdate event, so position has to be polled. Only
  // while playing, so an idle tab does no work.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      setPosition(player.getCurrentTime());
      const d = player.getDuration();
      if (d) setDuration(d);
    }, 500);
    return () => window.clearInterval(id);
  }, [playing]);

  const playQueue = useCallback((tracks: Track[], startIndex = 0) => {
    if (tracks.length === 0) return;
    const track = tracks[startIndex] ?? tracks[0]!;
    setQueue(tracks);
    setIndex(startIndex);
    setError(null);
    queueRef.current = tracks;
    indexRef.current = startIndex;

    unlockedRef.current = true;

    const player = playerRef.current;
    if (!player || !readyRef.current) {
      // Not ready yet — remember it and let onReady pick it up.
      pendingRef.current = track.youtubeId;
      return;
    }

    // This call is inside the click handler that reached us, so it counts as
    // the user gesture that unlocks programmatic playback later.
    player.loadVideoById(track.youtubeId);
  }, []);

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    if (player.getPlayerState() === PLAYER_STATE.PLAYING) player.pauseVideo();
    else {
      player.playVideo();
      unlockedRef.current = true;
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    if (!readyRef.current) return;
    playerRef.current?.seekTo(Math.max(0, seconds), true);
    setPosition(Math.max(0, seconds));
  }, []);

  const value = useMemo<PlayerApi>(
    () => ({
      queue,
      index,
      current: queue[index] ?? null,
      playing,
      position,
      duration,
      ready,
      error,
      shuffle,
      repeat,
      playQueue,
      toggle,
      next: () => advance(1, false),
      previous: () => advance(-1, false),
      seek,
      setShuffle: setShuffleState,
      cycleRepeat: () =>
        setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
      registerHost,
    }),
    [
      queue, index, playing, position, duration, ready, error, shuffle, repeat,
      playQueue, toggle, advance, seek, registerHost,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
