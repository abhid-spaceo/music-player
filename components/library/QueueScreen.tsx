'use client';

import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { usePlayer } from '@/components/player/PlayerProvider';
import { formatDuration } from '@/lib/format';
import { TrackRow } from './TrackRow';
import styles from './LibraryScreen.module.css';

export function QueueScreen() {
  const { queue, index, current, playQueue } = usePlayer();

  const remaining = queue.slice(index).reduce((n, t) => n + t.durationSec, 0);
  const meta =
    queue.length === 0
      ? 'NOTHING QUEUED'
      : `${queue.length} TRACKS · ${formatDuration(remaining)} LEFT`;

  return (
    <>
      <ScreenHeader title="Queue" meta={meta} />
      <div className={styles.rule} />
      <ol className={`${styles.list} no-scrollbar`}>
        {queue.length === 0 ? (
          <li className={styles.state}>
            Play something from the library and it shows up here.
          </li>
        ) : (
          queue.map((t, i) => (
            <TrackRow
              key={`${t.id}-${i}`}
              track={t}
              playing={current?.id === t.id}
              onPlay={() => playQueue(queue, i)}
            />
          ))
        )}
        <li className={styles.spacer} aria-hidden="true" />
      </ol>
    </>
  );
}
