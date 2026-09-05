import { redirect } from 'next/navigation';
import { getServerTheme } from '@/lib/theme/getServerTheme';
import { GlassAdminShell } from '@/components/admin/glass/GlassAdminShell';
import { GlassUsersPage } from '@/components/admin/glass/GlassUsersPage';

/** Glass admin sub-route. The current theme has no separate Users screen yet. */
export default async function AdminUsersPage() {
  if ((await getServerTheme()) !== 'glass') redirect('/admin');
  return (
    <GlassAdminShell title="Users">
      <GlassUsersPage />
    </GlassAdminShell>
  );
}
