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
import type { Track, TrackSource } from '@/lib/library/types';
import { audio } from '@/lib/player/audio-element';
import {
  attachMediaActions,
  clearMediaSession,
  setMediaMetadata,
  setMediaPlaybackState,
  setMediaPosition,
} from '@/lib/player/media-session';
import { reorder, removeAt as removeAtPure, indexAfterRemove } from '@/lib/player/queue';
import { shouldRecordPlay } from '@/lib/player/record-play';
import { apiSend } from '@/lib/api/client';

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
  /** 0-100. Mirrors the YouTube player, which owns the real value. */
  volume: number;
  muted: boolean;

  playQueue: (tracks: Track[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setShuffle: (on: boolean) => void;
  cycleRepeat: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  /** Registers the DOM node the iframe is mounted into. */
  registerHost: (node: HTMLDivElement | null) => void;
  /** Whether the full-screen Now Playing page is open. */
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  /** Play the queue item at `index`. */
  jumpTo: (index: number) => void;
  /** Move a queue item, keeping the current track selected. */
  reorderQueue: (from: number, to: number) => void;
  /** Drop a queue item, keeping the current track playing. */
  removeAt: (index: number) => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<PlaybackError>(null);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [expanded, setExpanded] = useState(false);
  /** Last track id we recorded a play for — dedupes repeats/seeks. */
  const lastRecordedRef = useRef<string | null>(null);

  /**
   * Which engine currently owns playback. Every callback checks it, so the
   * idle engine's stray events can never move the UI or the queue.
   */
  const activeSourceRef = useRef<TrackSource>('youtube');

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
  /** Read in onReady, which fires long after the first render. */
  const volumeRef = useRef(100);
  const mutedRef = useRef(false);

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
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  /** Record a play once per track change. Fire-and-forget; never blocks audio. */
  const recordPlay = useCallback((track: Track) => {
    if (!shouldRecordPlay(lastRecordedRef.current, track.id)) return;
    lastRecordedRef.current = track.id;
    void apiSend('/api/plays', 'POST', { trackId: track.id, source: 'queue' }).catch(() => {
      /* a missed stat must never interrupt music */
    });
  }, []);

  /**
   * Hand a track to the YouTube player, or park it for onReady when the player
   * does not exist yet. A track with no video id has no YouTube video to play,
   * so it is ignored here — its audio comes from elsewhere.
   */
  const startYouTube = useCallback((track: Track) => {
    if (!track.youtubeId) return;
    if (playerRef.current && readyRef.current) {
      playerRef.current.loadVideoById(track.youtubeId);
    } else {
      pendingRef.current = track.youtubeId;
    }
  }, []);

  /**
   * Start a track on whichever engine owns it, and silence the other one.
   * Two players running at once is the worst failure here, so the handover
   * always stops before it starts.
   */
  const startTrack = useCallback((track: Track) => {
    if (track.source === 'direct' && track.audioUrl) {
      if (readyRef.current) {
        try {
          playerRef.current?.pauseVideo();
        } catch {
          // A player that will not pause is still a player we are leaving.
        }
      }
      activeSourceRef.current = 'direct';
      audio.setVolume(volumeRef.current);
      audio.setMuted(mutedRef.current);
      audio.load(track.audioUrl);
      // Only our own <audio> can own the lock screen; the iframe keeps its own.
      setMediaMetadata(track);
      return;
    }
    activeSourceRef.current = 'youtube';
    audio.stop();
    clearMediaSession();
    startYouTube(track);
  }, [startYouTube]);

  const advance = useCallback((delta: number, auto: boolean) => {
    const q = queueRef.current;
    if (q.length === 0) return;

    if (auto && repeatRef.current === 'one') {
      if (activeSourceRef.current === 'direct') {
        audio.seek(0);
        audio.play();
      } else {
        playerRef.current?.seekTo(0, true);
        playerRef.current?.playVideo();
      }
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
    recordPlay(track);
    // loadVideoById starts playback itself. It is only reached after a
    // user-initiated first play, so the autoplay policy is satisfied.
    startTrack(track);
  }, [recordPlay, startTrack]);

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
              // The player starts at its own remembered volume. Push ours onto
              // it so the slider is telling the truth from the first frame.
              try {
                e.target.setVolume(volumeRef.current);
                if (mutedRef.current) e.target.mute();
              } catch {
                // A player that rejects a volume call is still a usable player.
              }
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
      // A direct track reports its own position through timeupdate. Polling it
      // here as well would overwrite a fresher value with a staler one.
      if (activeSourceRef.current === 'direct') return;
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      setPosition(player.getCurrentTime());
      const d = player.getDuration();
      if (d) setDuration(d);
    }, 500);
    return () => window.clearInterval(id);
  }, [playing]);

  /**
   * Wire the <audio> element's events into state. Every handler checks which
   * engine is active first: the element fires a `pause` when we hand playback
   * back to YouTube, and acting on that would stop the queue.
   */
  useEffect(() => {
    audio.attach({
      playingChanged: (isPlaying) => {
        if (activeSourceRef.current !== 'direct') return;
        setPlaying(isPlaying);
        setMediaPlaybackState(isPlaying);
      },
      ended: () => {
        if (activeSourceRef.current !== 'direct') return;
        advance(1, true);
      },
      failed: (message) => {
        if (activeSourceRef.current !== 'direct') return;
        const track = queueRef.current[indexRef.current];
        setError({ reason: 'audio', message, trackId: track?.id ?? '' });
        setPlaying(false);
      },
      progress: (pos, dur) => {
        if (activeSourceRef.current !== 'direct') return;
        setPosition(pos);
        if (dur) setDuration(dur);
        setMediaPosition(pos, dur);
      },
    });
  }, [advance]);

  /**
   * Lock-screen and notification buttons. Registered once; they act on the
   * <audio> element, which is the only playback we own.
   */
  useEffect(() => {
    attachMediaActions({
      play: () => audio.play(),
      pause: () => audio.pause(),
      next: () => advance(1, false),
      previous: () => advance(-1, false),
      stop: () => audio.pause(),
      seekTo: (seconds) => {
        audio.seek(seconds);
        setPosition(seconds);
      },
      seekBy: (offset) => {
        const target = Math.max(0, audio.position() + offset);
        audio.seek(target);
        setPosition(target);
      },
    });
  }, [advance]);

  /**
   * Coming back to the foreground, trust the element over our own state: a
   * background pause (an incoming call) happened without us hearing about it.
   * Never reload or re-seek here — that would restart the track.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden || activeSourceRef.current !== 'direct') return;
      setPosition(audio.position());
      setPlaying(audio.isPlaying());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const playQueue = useCallback((tracks: Track[], startIndex = 0) => {
    if (tracks.length === 0) return;
    const track = tracks[startIndex] ?? tracks[0]!;
    setQueue(tracks);
    setIndex(startIndex);
    setError(null);
    queueRef.current = tracks;
    indexRef.current = startIndex;
    recordPlay(track);

    unlockedRef.current = true;

    // This runs inside the click handler that reached us, so it counts as the
    // user gesture that unlocks programmatic playback later. A track arriving
    // before the player exists is parked and picked up by onReady.
    startTrack(track);
  }, [recordPlay, startTrack]);

  const toggle = useCallback(() => {
    if (activeSourceRef.current === 'direct') {
      if (audio.isPlaying()) audio.pause();
      else {
        audio.play();
        unlockedRef.current = true;
      }
      return;
    }
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    if (player.getPlayerState() === PLAYER_STATE.PLAYING) player.pauseVideo();
    else {
      player.playVideo();
      unlockedRef.current = true;
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const target = Math.max(0, seconds);
    if (activeSourceRef.current === 'direct') {
      audio.seek(target);
      setPosition(target);
      return;
    }
    if (!readyRef.current) return;
    playerRef.current?.seekTo(target, true);
    setPosition(target);
  }, []);

  const jumpTo = useCallback((i: number) => {
    const q = queueRef.current;
    if (i < 0 || i >= q.length) return;
    const track = q[i]!;
    setIndex(i);
    setError(null);
    recordPlay(track);
    startTrack(track);
  }, [recordPlay, startTrack]);

  const reorderQueue = useCallback((from: number, to: number) => {
    setQueue((prev) => {
      const currentId = prev[indexRef.current]?.id;
      const nextQueue = reorder(prev, from, to);
      const newIndex = nextQueue.findIndex((t) => t.id === currentId);
      if (newIndex >= 0) setIndex(newIndex);
      return nextQueue;
    });
  }, []);

  const removeAt = useCallback((i: number) => {
    setQueue((prev) => {
      const nextQueue = removeAtPure(prev, i);
      setIndex((cur) => indexAfterRemove(cur, i));
      return nextQueue;
    });
  }, []);

  /**
   * Volume lives in the YouTube player; this only mirrors it. Setting a level
   * above zero also unmutes, because a slider that moves while silent is a lie.
   */
  const setVolume = useCallback((next: number) => {
    const clamped = Math.round(Math.min(100, Math.max(0, next)));
    setVolumeState(clamped);
    audio.setVolume(clamped);
    if (clamped > 0 && mutedRef.current) {
      audio.setMuted(false);
    }
    const player = playerRef.current;
    if (!player) return;
    try {
      player.setVolume(clamped);
      if (clamped > 0 && mutedRef.current) {
        player.unMute();
        setMuted(false);
      }
    } catch {
      // Pre-ready players throw; the level is applied again in onReady.
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    setMuted(next);
    audio.setMuted(next);
    const player = playerRef.current;
    if (!player) return;
    try {
      if (next) player.mute();
      else {
        player.unMute();
        // Unmuting at zero would stay silent and look broken.
        if (volumeRef.current === 0) {
          player.setVolume(50);
          setVolumeState(50);
        }
      }
    } catch {
      // Same as above: onReady re-applies.
    }
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
      volume,
      muted,
      playQueue,
      toggle,
      next: () => advance(1, false),
      previous: () => advance(-1, false),
      seek,
      setShuffle: setShuffleState,
      cycleRepeat: () =>
        setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
      setVolume,
      toggleMute,
      registerHost,
      expanded,
      setExpanded,
      jumpTo,
      reorderQueue,
      removeAt,
    }),
    [
      queue, index, playing, position, duration, ready, error, shuffle, repeat,
      volume, muted, expanded,
      playQueue, toggle, advance, seek, setVolume, toggleMute, registerHost,
      jumpTo, reorderQueue, removeAt,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
