import { AdminScreen } from '@/components/admin/AdminScreen';
import { GlassAdminScreen } from '@/components/admin/GlassAdminScreen';
import { getServerTheme } from '@/lib/theme/getServerTheme';

export default async function AdminPage() {
  const theme = await getServerTheme();
  return theme === 'glass' ? <GlassAdminScreen /> : <AdminScreen />;
}
