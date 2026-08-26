import { AppShell } from '@/components/chrome/AppShell';
import { PlayerProvider } from '@/components/player/PlayerProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <AppShell>{children}</AppShell>
    </PlayerProvider>
  );
}
