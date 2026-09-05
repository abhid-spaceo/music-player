import { redirect } from 'next/navigation';
import { getServerTheme } from '@/lib/theme/getServerTheme';
import { GlassAdminShell } from '@/components/admin/glass/GlassAdminShell';
import { TrackAdminPanel } from '@/components/admin/TrackAdminPanel';

/** Glass admin sub-route. In the current theme the tabbed /admin owns Tracks. */
export default async function AdminTracksPage() {
  if ((await getServerTheme()) !== 'glass') redirect('/admin');
  return (
    <GlassAdminShell title="Tracks">
      <TrackAdminPanel />
    </GlassAdminShell>
  );
}
