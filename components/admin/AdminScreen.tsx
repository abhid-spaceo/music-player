'use client';

import { useState } from 'react';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { AddTracksPanel } from './AddTracksPanel';
import { PlaylistImportPanel } from './PlaylistImportPanel';
import { TrackAdminPanel } from './TrackAdminPanel';
import styles from './AdminScreen.module.css';

type Tab = 'add' | 'playlist' | 'tracks';

const META: Record<Tab, string> = {
  add: 'ADD LINKS',
  playlist: 'PLAYLIST',
  tracks: 'TRACKS',
};

export function AdminScreen() {
  const [tab, setTab] = useState<Tab>('add');

  return (
    <>
      <ScreenHeader
        title="Admin"
        meta={META[tab]}
        below={
          <div className={styles.tabs} role="tablist" aria-label="Admin sections">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'add'}
              className={styles.tab}
              onClick={() => setTab('add')}
            >
              ADD LINKS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'playlist'}
              className={styles.tab}
              onClick={() => setTab('playlist')}
            >
              PLAYLIST
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'tracks'}
              className={styles.tab}
              onClick={() => setTab('tracks')}
            >
              TRACKS
            </button>
          </div>
        }
      />
      {tab === 'add' ? (
        <AddTracksPanel />
      ) : tab === 'playlist' ? (
        <PlaylistImportPanel />
      ) : (
        <TrackAdminPanel />
      )}
    </>
  );
}
