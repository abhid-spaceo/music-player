import { SearchScreen } from '@/components/library/SearchScreen';
import { GlassSearchScreen } from '@/components/library/GlassSearchScreen';
import { getServerTheme } from '@/lib/theme/getServerTheme';

export default async function SearchPage() {
  const theme = await getServerTheme();
  return theme === 'glass' ? <GlassSearchScreen /> : <SearchScreen />;
}
