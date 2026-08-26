/**
 * Loads the YouTube IFrame Player API exactly once per page.
 *
 * The API calls a single global `onYouTubeIframeAPIReady`, so concurrent
 * callers must share one promise or the second one clobbers the first.
 */

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;

export const PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YTPlayer = {
  loadVideoById(id: string, startSeconds?: number): void;
  cueVideoById(id: string, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YTPlayerState;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId?: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: YTPlayerState; target: YTPlayer }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

let loader: Promise<YTNamespace> | null = null;

export function loadIframeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IFrame API is browser-only'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loader) return loader;

  loader = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('IFrame API loaded without YT.Player'));
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('Could not load the YouTube IFrame API'));
    document.head.appendChild(script);
  });

  return loader;
}

/**
 * The five errors the player can report. 101 and 150 are the same condition
 * reported two ways, and both are indistinguishable from age restriction at
 * playback — which is why age restriction is detected at ingest instead.
 */
export function describePlayerError(code: number): { reason: string; message: string } {
  switch (code) {
    case 2:
      return { reason: 'bad-id', message: 'That video ID is not valid.' };
    case 5:
      return { reason: 'html5', message: 'This video cannot play in the HTML5 player.' };
    case 100:
      return {
        reason: 'unavailable',
        // The docs give both causes for this one code, so we do not guess.
        message: 'This video has been removed or made private.',
      };
    case 101:
    case 150:
      return {
        reason: 'not-embeddable',
        message: 'The owner does not allow this video to play outside YouTube.',
      };
    default:
      return { reason: 'unknown', message: `Playback failed (error ${code}).` };
  }
}
