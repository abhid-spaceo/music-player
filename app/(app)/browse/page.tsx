import { BrowseScreen } from '@/components/library/BrowseScreen';
import { GlassBrowseScreen } from '@/components/library/GlassBrowseScreen';
import { getServerTheme } from '@/lib/theme/getServerTheme';

export default async function BrowsePage() {
  const theme = await getServerTheme();
  return theme === 'glass' ? <GlassBrowseScreen /> : <BrowseScreen />;
}
