import { ScreenHeader } from '@/components/chrome/ScreenHeader';

/** Playlists are Phase 5. This is an honest placeholder, not a broken link. */
export default function PlaylistsPage() {
  return (
    <>
      <ScreenHeader title="Playlists" meta="NONE YET" />
      <p style={{ padding: '28px var(--gutter)', font: 'var(--t-row-artist)', color: 'var(--dim)' }}>
        Playlists, favourites and reordering are not built yet.
      </p>
    </>
  );
}
