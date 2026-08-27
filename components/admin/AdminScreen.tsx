'use client';

import { useState } from 'react';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { AddTracksPanel } from './AddTracksPanel';
import { TrackAdminPanel } from './TrackAdminPanel';
import styles from './AdminScreen.module.css';

type Tab = 'add' | 'tracks';

export function AdminScreen() {
  const [tab, setTab] = useState<Tab>('add');

  return (
    <>
      <ScreenHeader
        title="Admin"
        meta={tab === 'add' ? 'ADD LINKS' : 'TRACKS'}
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
              aria-selected={tab === 'tracks'}
              className={styles.tab}
              onClick={() => setTab('tracks')}
            >
              TRACKS
            </button>
          </div>
        }
      />
      {tab === 'add' ? <AddTracksPanel /> : <TrackAdminPanel />}
    </>
  );
}
