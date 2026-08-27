import { PlaylistDetailScreen } from '@/components/library/PlaylistDetailScreen';

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlaylistDetailScreen id={id} />;
}
