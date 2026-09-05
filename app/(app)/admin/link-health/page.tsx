import { redirect } from 'next/navigation';
import { getServerTheme } from '@/lib/theme/getServerTheme';
import { GlassAdminShell } from '@/components/admin/glass/GlassAdminShell';
import { GlassLinkHealthPage } from '@/components/admin/glass/GlassLinkHealthPage';

/** Glass admin sub-route. The current theme surfaces this inside the Tracks tab. */
export default async function AdminLinkHealthPage() {
  if ((await getServerTheme()) !== 'glass') redirect('/admin');
  return (
    <GlassAdminShell title="Link health">
      <GlassLinkHealthPage />
    </GlassAdminShell>
  );
}
