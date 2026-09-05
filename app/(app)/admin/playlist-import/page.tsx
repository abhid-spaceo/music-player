import { redirect } from 'next/navigation';
import { getServerTheme } from '@/lib/theme/getServerTheme';
import { GlassAdminShell } from '@/components/admin/glass/GlassAdminShell';
import { PlaylistImportPanel } from '@/components/admin/PlaylistImportPanel';

/** Glass admin sub-route. In the current theme the tabbed /admin owns this. */
export default async function AdminPlaylistImportPage() {
  if ((await getServerTheme()) !== 'glass') redirect('/admin');
  return (
    <GlassAdminShell title="Playlist import">
      <PlaylistImportPanel />
    </GlassAdminShell>
  );
}
