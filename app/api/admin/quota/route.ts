import { handleError, ok } from '@/lib/api/respond';
import { requireAdmin } from '@/lib/auth/guard';
import { getQuotaToday } from '@/lib/youtube/quota';

/** Today's YouTube quota usage, for the admin quota widget. Admin-only. */
export async function GET() {
  try {
    await requireAdmin();
    return ok(await getQuotaToday());
  } catch (err) {
    return handleError(err);
  }
}
