'use client';

import { useRef, useState } from 'react';
import { nudge, secondsFromRatio } from '@/lib/player/seek';
import { formatDuration } from '@/lib/format';
import styles from './SeekBar.module.css';

type Props = {
  position: number;
  total: number;
  onSeek: (seconds: number) => void;
  variant?: 'mini' | 'full';
  ariaLabel?: string;
};

/** A click/drag/keyboard seek bar shared by the mini player and Now Playing. */
export function SeekBar({
  position,
  total,
  onSeek,
  variant = 'mini',
  ariaLabel = 'Playback position',
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null); // seconds while dragging

  const shown = drag ?? position;
  const pct = total > 0 ? `${Math.min(100, (shown / total) * 100).toFixed(2)}%` : '0%';

  const secondsAt = (clientX: number): number => {
    const box = barRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    return secondsFromRatio((clientX - box.left) / box.width, total);
  };

  return (
    <div
      ref={barRef}
      className={`${styles.bar} ${styles[variant]}`}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={`${formatDuration(shown)} of ${formatDuration(total)}`}
      onPointerDown={(e) => {
        if (total <= 0) return;
        // Track the drag on WINDOW listeners driven by plain closures — not on
        // this element gated by the `drag` React state. The old code checked
        // `drag === null` inside pointermove/up, but React state commits on the
        // next render; on Android (busier main thread) a press+release finished
        // BEFORE that commit, so the up handler still saw null and bailed — the
        // seek silently did nothing. Closures update instantly, so there is no
        // race, and window listeners keep tracking even when the finger drifts
        // off the thin 12px bar (which also removes the setPointerCapture
        // dependency that made the thin target fragile).
        setDrag(secondsAt(e.clientX));
        const move = (ev: PointerEvent) => setDrag(secondsAt(ev.clientX));
        const end = (ev: PointerEvent) => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', abort);
          const secs = secondsAt(ev.clientX);
          setDrag(null);
          onSeek(secs);
        };
        const abort = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', abort);
          setDrag(null);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', abort);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onSeek(nudge(position, -5, total));
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onSeek(nudge(position, 5, total));
        }
      }}
    >
      <i className={styles.fill} style={{ width: pct }} />
      <i className={styles.knob} style={{ left: pct }} aria-hidden="true" />
      {drag !== null ? (
        <span className={styles.preview} style={{ left: pct }}>
          {formatDuration(drag)}
        </span>
      ) : null}
    </div>
  );
}
