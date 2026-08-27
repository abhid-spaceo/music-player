'use client';

import { FavouriteButton } from '@/components/primitives/FavouriteButton';
import { formatDuration } from '@/lib/format';
import { AVAILABILITY_LABEL, isPlayable, type Track } from '@/lib/library/types';
import styles from './TrackRow.module.css';

type Props = { track: Track; playing: boolean; onPlay: (t: Track) => void };

export function TrackRow({ track, playing, onPlay }: Props) {
  const blocked = !isPlayable(track);
  const note = AVAILABILITY_LABEL[track.availability];

  return (
    <li
      className={styles.row}
      data-playing={playing}
      data-blocked={blocked}
      // Surfaces which video a row is, for debugging and for tests that need a
      // known-real id rather than a title that a refresh may have rewritten.
      data-youtube-id={track.youtubeId}
      aria-current={playing ? 'true' : undefined}
    >
      <button
        type="button"
        className={styles.playHit}
        onClick={() => onPlay(track)}
        disabled={blocked}
        aria-label={
          blocked
            ? `${track.title} by ${track.channelTitle} — ${note}`
            : `Play ${track.title} by ${track.channelTitle}`
        }
      />

      <div className={styles.text}>
        <div className={`${styles.title} truncate`}>{track.title}</div>
        <div className={`${styles.channel} truncate`}>{track.channelTitle}</div>
      </div>

      <span className={styles.status}>
        {blocked ? (
          <>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M6 18 18 6" />
            </svg>
            <span className="sr-only">{note}</span>
          </>
        ) : null}
      </span>

      <span className={`${styles.time} tnum`}>{formatDuration(track.durationSec)}</span>

      <FavouriteButton
        className={styles.overflow}
        trackId={track.id}
        initial={track.isFavourite}
        title={track.title}
      />
    </li>
  );
}
