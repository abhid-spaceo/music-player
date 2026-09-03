'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api/client';
import { FavouriteButton } from '@/components/primitives/FavouriteButton';
import { PauseIcon, PlayIcon, ShuffleIcon } from '@/components/primitives/Icons';
import { formatDuration } from '@/lib/format';
import { usePlayer } from './PlayerProvider';
import { SeekBar } from './SeekBar';
import { AddToPlaylistMenu } from './AddToPlaylistMenu';
import styles from './NowPlaying.module.css';

type PlayStats = { count: number; lastPlayedAt: string | null };
type StatsState = (PlayStats & { forId: string }) | null;

export function NowPlaying() {
  const {
    current, queue, index, playing, position, duration, expanded, setExpanded,
    toggle, next, previous, seek, shuffle, setShuffle, repeat, cycleRepeat,
    jumpTo, reorderQueue, removeAt,
  } = usePlayer();

  const [showAdd, setShowAdd] = useState(false);
  const [stats, setStats] = useState<StatsState>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const total = duration || current?.durationSec || 0;
  const currentId = current?.id;

  useEffect(() => {
    if (!expanded || !currentId) return;
    let cancelled = false;
    apiGet<PlayStats>(`/api/plays?trackId=${currentId}`)
      .then((res) => {
        if (!cancelled) setStats({ ...res.data, forId: currentId });
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, currentId]);

  // Only trust stats that belong to the track on screen (avoids a stale flash).
  const shownStats = stats && stats.forId === currentId ? stats : null;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, setExpanded]);

  if (!expanded || !current) return null;

  const upNext = queue.slice(index + 1);

  return (
    <div className={styles.overlay} role="dialog" aria-label="Now playing">
      <header className={styles.top}>
        <button type="button" className={styles.chevron} onClick={() => setExpanded(false)} aria-label="Close now playing">⌄</button>
        <span>Now Playing</span>
        <span aria-hidden="true" className={styles.spacer} />
      </header>

      <div className={styles.artWrap}>
        {current.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.thumbnailUrl} alt="" className={styles.art} />
        ) : (
          <div className={styles.art} />
        )}
      </div>

      <h1 className={styles.title}>{current.title}</h1>
      <p className={styles.artist}>{current.sortArtist ?? current.channelTitle}</p>

      <div className={styles.actions}>
        <FavouriteButton
          key={current.id}
          trackId={current.id}
          initial={current.isFavourite}
          title={current.title}
          className={styles.actBtn}
        />
        <button type="button" className={styles.actBtn} onClick={() => setShowAdd(true)} aria-label="Add to playlist">
          ＋ Playlist
        </button>
        <span className={styles.plays}>
          {shownStats ? `▶ ${shownStats.count} play${shownStats.count === 1 ? '' : 's'}` : '▶ …'}
        </span>
      </div>

      <SeekBar position={position} total={total} onSeek={seek} variant="full" />
      <div className={styles.times}>
        <span>{formatDuration(position)}</span>
        <span>{formatDuration(total)}</span>
      </div>

      <div className={styles.transport}>
        <button type="button" className={styles.ctl} onClick={() => setShuffle(!shuffle)} aria-pressed={shuffle} aria-label="Shuffle" data-off={!shuffle}>
          <ShuffleIcon size={20} />
        </button>
        <button type="button" className={styles.ctl} onClick={previous} aria-label="Previous track">⏮</button>
        <button type="button" className={styles.play} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className={styles.ctl} onClick={next} aria-label="Next track">⏭</button>
        <button type="button" className={styles.ctl} onClick={cycleRepeat} aria-label={`Repeat: ${repeat}`} data-off={repeat === 'off'}>
          🔁{repeat === 'one' ? '¹' : ''}
        </button>
      </div>

      <section className={styles.upNext} aria-label="Up next">
        <h2>Up Next</h2>
        {upNext.length === 0 ? <p className={styles.empty}>Nothing queued.</p> : null}
        <ul>
          {upNext.map((t, i) => {
            const qIndex = index + 1 + i;
            return (
              <li
                key={t.id}
                className={styles.row}
                draggable
                onDragStart={() => setDragFrom(qIndex)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom !== null && dragFrom !== qIndex) reorderQueue(dragFrom, qIndex);
                  setDragFrom(null);
                }}
              >
                <span className={styles.handle} aria-hidden="true">⠿</span>
                <button type="button" className={styles.rowMain} onClick={() => jumpTo(qIndex)}>
                  <span className={styles.rowTitle}>{t.title}</span>
                  <span className={styles.rowArtist}>{t.sortArtist ?? t.channelTitle}</span>
                </button>
                <button type="button" className={styles.remove} onClick={() => removeAt(qIndex)} aria-label={`Remove ${t.title} from queue`}>✕</button>
              </li>
            );
          })}
        </ul>
      </section>

      {showAdd ? <AddToPlaylistMenu trackId={current.id} onClose={() => setShowAdd(false)} /> : null}
    </div>
  );
}
