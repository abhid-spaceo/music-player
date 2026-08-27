'use client';

import { useState } from 'react';
import { apiSend } from '@/lib/api/client';

type Props = { trackId: string; initial: boolean; className?: string; title: string };

/**
 * The row's 44px trailing control. The canvas draws an overflow menu here, but
 * that menu is not designed anywhere in the export and the only action it was
 * ever described as holding (queue/download) is either already covered or
 * impossible in this architecture — so the slot does the one thing that is
 * actually useful.
 */
export function FavouriteButton({ trackId, initial, className, title }: Props) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(event: React.MouseEvent) {
    // The whole row is a play button underneath; do not start playback.
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !on;
    setOn(next); // optimistic
    try {
      await apiSend(`/api/favourites/${trackId}`, next ? 'PUT' : 'DELETE');
    } catch {
      setOn(!next); // roll back
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
      data-on={on}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 20.5 4.5 13a4.7 4.7 0 0 1 0-6.6 4.7 4.7 0 0 1 6.6 0l.9.9.9-.9a4.7 4.7 0 0 1 6.6 0 4.7 4.7 0 0 1 0 6.6z" />
      </svg>
    </button>
  );
}
