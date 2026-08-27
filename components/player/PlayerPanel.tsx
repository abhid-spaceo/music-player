'use client';

import { usePlayer } from './PlayerProvider';
import { PauseIcon, PlayIcon, ShuffleIcon } from '@/components/primitives/Icons';
import { formatDuration } from '@/lib/format';
import styles from './PlayerPanel.module.css';

/**
 * The player surface. Rendered by the (app) layout, so it survives every
 * client-side navigation — if this node were inside a page it would unmount on
 * route change and playback would stop.
 *
 * Collapses to nothing when the queue is empty, so an idle library gets the
 * full list height back.
 */
export function PlayerPanel() {
  const {
    current, playing, position, duration, error, repeat, shuffle,
    toggle, next, previous, seek, setShuffle, cycleRepeat, registerHost,
  } = usePlayer();

  const total = duration || current?.durationSec || 0;
  const pct = total > 0 ? `${Math.min(100, (position / total) * 100).toFixed(1)}%` : '0%';

  return (
    <section
      className={styles.panel}
      aria-label="Player"
      // Kept in the tree but zero-height when idle, so the iframe is never
      // destroyed and re-created.
      style={current ? undefined : { display: 'none' }}
    >
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(position)}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          if (total > 0) seek(((e.clientX - box.left) / box.width) * total);
        }}
      >
        <i className={styles.fill} style={{ '--pos': pct } as React.CSSProperties} />
      </div>

      <div className={styles.body}>
        {/* The iframe lands here. registerHost runs once; the node is never
            replaced, which is what keeps audio alive across navigation. */}
        <div className={styles.embed} ref={registerHost} />

        <div className={styles.meta}>
          {/* Three zones on desktop: identity, transport, aside. Wrapped so the
              grid places blocks, not overlapping individual lines. */}
          <div className={styles.identity}>
            <div className={`${styles.title} truncate`}>{current?.title ?? ''}</div>
            <div className={`${styles.channel} truncate`}>{current?.channelTitle ?? ''}</div>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.ctl}
              onClick={previous}
              aria-label="Previous track"
            >
              <span style={{ transform: 'scaleX(-1)', display: 'flex' }}>
                <SkipGlyph />
              </span>
            </button>
            <button
              type="button"
              className={styles.ctl}
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className={styles.ctl} onClick={next} aria-label="Next track">
              <SkipGlyph />
            </button>
            <button
              type="button"
              className={styles.ctl}
              onClick={() => setShuffle(!shuffle)}
              aria-pressed={shuffle}
              data-off={!shuffle}
              aria-label="Shuffle"
            >
              <ShuffleIcon size={17} />
            </button>
            <button
              type="button"
              className={styles.ctl}
              onClick={cycleRepeat}
              data-off={repeat === 'off'}
              aria-label={`Repeat: ${repeat}`}
            >
              <RepeatGlyph one={repeat === 'one'} />
            </button>
          </div>

          <div className={styles.aside}>
            <div className={`${styles.times} tnum`}>
              {formatDuration(position)} / {formatDuration(total)}
            </div>
            {current ? (
              <a
                className={styles.attribution}
                href={`https://www.youtube.com/watch?v=${current.youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WATCH ON YOUTUBE
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="status">
          {error.message}
        </p>
      ) : null}
    </section>
  );
}

const SkipGlyph = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M5 4l11 8-11 8z" />
    <rect x="17" y="4" width="2.6" height="16" />
  </svg>
);

const RepeatGlyph = ({ one }: { one: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    {one ? <path d="M11 10h2v5" /> : null}
  </svg>
);
