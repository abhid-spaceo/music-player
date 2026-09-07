/**
 * The single <audio> element the whole app plays through.
 *
 * There is exactly one. It is created on first use and never replaced, because
 * phones unlock the ELEMENT, not the page: once a real tap has started playback
 * on it, later play() calls are allowed without a gesture, which is what lets
 * the queue advance on its own while the screen is locked. A fresh element per
 * track would lose that, and track 2 would be blocked.
 *
 * It lives outside React deliberately, so navigation, re-render and closing the
 * player view cannot touch it. This is the path the YouTube IFrame embed cannot
 * offer: the browser will not grant a background audio session to a sealed
 * cross-origin iframe, but it will to an element we own.
 */

export type AudioHandlers = {
  /** Fired for OS-driven pauses (an incoming call) as well as our own. */
  playingChanged(playing: boolean): void;
  ended(): void;
  failed(message: string): void;
  /** Driven by `timeupdate`, never a timer — a throttled timer must not stall UI. */
  progress(position: number, duration: number): void;
};

let element: HTMLAudioElement | null = null;
let handlers: AudioHandlers | null = null;

/** The five MediaError codes, worded for someone who is not a developer. */
function describe(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback was cancelled.';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'The connection dropped while loading this track.';
    case MediaError.MEDIA_ERR_DECODE:
      return 'This audio file is damaged or in an unsupported format.';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'That audio link could not be played. It may have moved or been removed.';
    default:
      return 'Playback failed.';
  }
}

function get(): HTMLAudioElement {
  if (element) return element;
  // Created lazily: `new Audio()` does not exist during server rendering.
  element = new Audio();
  // metadata only — preloading whole tracks would burn the listener's data on
  // songs they may never reach.
  element.preload = 'metadata';

  element.addEventListener('playing', () => handlers?.playingChanged(true));
  element.addEventListener('pause', () => handlers?.playingChanged(false));
  element.addEventListener('ended', () => handlers?.ended());
  element.addEventListener('error', () => handlers?.failed(describe(element!.error)));
  element.addEventListener('timeupdate', () => {
    const d = element!.duration;
    handlers?.progress(element!.currentTime, Number.isFinite(d) ? d : 0);
  });
  element.addEventListener('loadedmetadata', () => {
    const d = element!.duration;
    handlers?.progress(element!.currentTime, Number.isFinite(d) ? d : 0);
  });
  return element;
}

export const audio = {
  /** Registers the callbacks. Called once; a second call replaces the first. */
  attach(next: AudioHandlers): void {
    handlers = next;
  },

  /**
   * Point the element at a new track and start it. Only `src` changes — the
   * element itself survives, which is what keeps it unlocked.
   */
  load(url: string): void {
    const el = get();
    el.src = url;
    void el.play().catch((err: unknown) => {
      // A rejection here is the autoplay policy, not a broken file. It should
      // only ever happen before the first real tap.
      handlers?.failed(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Tap play to start — your browser needs a tap before it will play audio.'
          : 'Playback could not be started.',
      );
    });
  },

  play(): void {
    void get().play().catch(() => {
      handlers?.failed('Playback could not be resumed.');
    });
  },

  pause(): void {
    get().pause();
  },

  seek(seconds: number): void {
    get().currentTime = Math.max(0, seconds);
  },

  /** 0-100, to match the YouTube player. The element itself wants 0-1. */
  setVolume(volume: number): void {
    get().volume = Math.min(100, Math.max(0, volume)) / 100;
  },

  setMuted(muted: boolean): void {
    get().muted = muted;
  },

  isPlaying(): boolean {
    return element ? !element.paused : false;
  },

  position(): number {
    return element?.currentTime ?? 0;
  },

  /** Stop and release the network, without destroying the element. */
  stop(): void {
    if (!element) return;
    element.pause();
    element.removeAttribute('src');
    element.load();
  },
};
