'use client';

import { FavouriteButton } from '@/components/primitives/FavouriteButton';
import { PauseIcon, PlayIcon, ShuffleIcon } from '@/components/primitives/Icons';
import { formatDuration } from '@/lib/format';
import { usePlayer } from './PlayerProvider';
import { SeekBar } from './SeekBar';
import styles from './PlayerPanel.module.css';

/**
 * The player surface. Rendered by the (app) layout, so it survives every
 * client-side navigation — if this node were inside a page it would unmount on
 * route change and playback would stop.
 *
 * Collapses to nothing when the queue is empty, so an idle library gets the
 * full list height back.
 *
 * Layout: one row on desktop — artwork and identity left, transport locked to
 * the bar's centre line, times and attribution right. On a phone the same parts
 * stack, because a 390px row cannot hold all of them.
 */
export function PlayerPanel() {
  const {
    current, playing, position, duration, error, repeat, shuffle, volume, muted,
    toggle, next, previous, seek, setShuffle, cycleRepeat, setVolume, toggleMute,
    registerHost, setExpanded,
  } = usePlayer();

  const total = duration || current?.durationSec || 0;

  return (
    <section
      className={styles.panel}
      aria-label="Player"
      // Kept in the tree but zero-height when idle, so the iframe is never
      // destroyed and re-created.
      style={current ? undefined : { display: 'none' }}
    >
      <div className={styles.body}>
        {/*
          * The cage hides the player with INLINE styles, not a class. A
          * stylesheet arrives after first paint, and for those few frames a
          * class-hidden iframe renders at YouTube's default 640x390 in the
          * middle of the bar — which is exactly the video the owner asked not
          * to see. Inline styles are in the DOM from the first frame.
          *
          * It is also a wrapper rather than the host itself: `new YT.Player()`
          * REPLACES the node it is given, so anything set on the host is at the
          * mercy of what the API copies across. The cage is never touched.
          *
          * Parked, not removed: a `display: none` or zero-sized player gets
          * throttled or refused outright by the browser's media stack and by
          * YouTube's own player. It keeps a real 200x200 box, off-view.
          */}
        <div
          className={styles.embedCage}
          style={{
            position: 'fixed',
            right: 0,
            bottom: 0,
            width: 200,
            height: 200,
            opacity: 0.001,
            pointerEvents: 'none',
            zIndex: -1,
            overflow: 'hidden',
          }}
        >
          {/* registerHost runs once; the audio survives navigation because this
              subtree is in the layout, not in a page. */}
          <div ref={registerHost} />
        </div>

        <div
          className={styles.identity}
          role="button"
          tabIndex={0}
          aria-label="Open now playing"
          onClick={() => current && setExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (current) setExpanded(true);
            }
          }}
        >
          {/* YouTube's own thumbnail, shown unaltered. No alt text: the title
              sits right beside it, so describing it again is noise. */}
          <span className={styles.art}>
            {current?.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.thumbnailUrl} alt="" className={styles.artImg} />
            ) : null}
            {playing ? <EqualiserGlyph /> : null}
          </span>

          <span className={styles.identityText}>
            <span className={`${styles.title} truncate`}>{current?.title ?? ''}</span>
            <span className={`${styles.channel} truncate`}>{current?.channelTitle ?? ''}</span>
          </span>

          {current ? (
            // Keyed by track: the button holds its own optimistic state, so
            // without a fresh mount it would keep showing the previous song's
            // heart when the queue advances.
            <FavouriteButton
              key={current.id}
              trackId={current.id}
              initial={current.isFavourite}
              title={current.title}
              className={styles.heart}
            />
          ) : null}
        </div>

        <div className={styles.controls}>
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
            onClick={previous}
            aria-label="Previous track"
          >
            <span className={styles.flip}>
              <SkipGlyph />
            </span>
          </button>
          <button
            type="button"
            className={styles.primary}
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
            onClick={cycleRepeat}
            data-off={repeat === 'off'}
            aria-label={`Repeat: ${repeat}`}
          >
            <RepeatGlyph one={repeat === 'one'} />
          </button>
        </div>

        <div className={styles.aside}>
          <span className={`${styles.time} tnum`}>{formatDuration(position)}</span>
          <span className={styles.scrub}>
            <SeekBar position={position} total={total} onSeek={seek} variant="scrub" />
          </span>
          <span className={`${styles.time} tnum`}>{formatDuration(total)}</span>

          <button
            type="button"
            className={styles.ctl}
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <VolumeGlyph muted={muted || volume === 0} />
          </button>
          <input
            className={styles.volume}
            type="range"
            min={0}
            max={100}
            step={1}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            style={{ '--pos': `${muted ? 0 : volume}%` } as React.CSSProperties}
          />

          {current ? (
            <a
              className={styles.attribution}
              href={`https://www.youtube.com/watch?v=${current.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.attrLong}>WATCH ON </span>YOUTUBE ↗
            </a>
          ) : null}
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

/** Three bars, animated only while playing. Purely decorative. */
const EqualiserGlyph = () => (
  <span className={styles.eq} aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

const VolumeGlyph = ({ muted }: { muted: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" stroke="none" />
    {muted ? (
      <>
        <path d="M17 9.5l4 5" />
        <path d="M21 9.5l-4 5" />
      </>
    ) : (
      <>
        <path d="M16.5 8.5a5 5 0 0 1 0 7" />
        <path d="M19 6a8.5 8.5 0 0 1 0 12" />
      </>
    )}
  </svg>
);

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
