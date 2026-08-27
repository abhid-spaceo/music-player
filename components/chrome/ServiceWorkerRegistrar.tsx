'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/components/player/PlayerProvider';

/**
 * Registers the Service Worker and holds a waiting update back until nothing is
 * playing. Letting a new worker take over mid-track is the classic way a PWA
 * update kills the audio.
 */
export function ServiceWorkerRegistrar() {
  const { playing } = usePlayer();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (cancelled) return;
        // Ask a waiting worker to activate only while the player is idle.
        const promote = () => {
          if (!playing && registration.waiting) {
            registration.waiting.postMessage('skip-waiting');
          }
        };
        promote();
        registration.addEventListener('updatefound', promote);
      })
      .catch(() => {
        // A failed registration must never break the app.
      });

    return () => {
      cancelled = true;
    };
  }, [playing]);

  return null;
}
