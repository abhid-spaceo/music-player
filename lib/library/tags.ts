export type TagRow = { kind: 'mood' | 'genre'; name: string };

export function groupTags(rows: readonly TagRow[]): { moods: string[]; genres: string[] } {
  const moods: string[] = [];
  const genres: string[] = [];
  for (const r of rows) (r.kind === 'mood' ? moods : genres).push(r.name);
  return { moods, genres };
}
