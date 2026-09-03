import { handleError, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/auth/guard';
import { query } from '@/lib/db/client';

/** The curated mood/genre taxonomy. Any signed-in user may read it. */
export async function GET() {
  try {
    await requireUser();
    const rows = await query<{ id: string; kind: string; name: string; slug: string }>(
      'SELECT id, kind, name, slug FROM tags ORDER BY kind, name',
    );
    return ok(rows);
  } catch (err) {
    return handleError(err);
  }
}
