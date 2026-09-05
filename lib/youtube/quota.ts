import { query, queryOne } from '@/lib/db/client';
import { dailyLimit, ptDate } from './quota-date';

/**
 * The YouTube quota store. Pure date/limit helpers live in `./quota-date.ts`
 * (DB-free so they load without a DATABASE_URL); this file owns the reads/writes.
 */

/**
 * Add `units` to today's Pacific-date bucket. A no-op for non-positive input, so
 * callers can pass a call count blindly. Idempotent per statement via upsert.
 */
export async function recordQuota(units: number): Promise<void> {
  if (!Number.isFinite(units) || units <= 0) return;
  await query(
    `INSERT INTO quota_usage (pt_date, units_spent)
       VALUES ($1, $2)
       ON CONFLICT (pt_date)
       DO UPDATE SET units_spent = quota_usage.units_spent + EXCLUDED.units_spent`,
    [ptDate(), Math.round(units)],
  );
}

/**
 * Fire-and-forget wrapper for the `onQuota` hook on the YouTube fetchers: record
 * the units, but never let a metering write reject the API call that spent them.
 */
export function recordQuotaFireAndForget(units: number): void {
  void recordQuota(units).catch(() => {
    // Losing a metering write is acceptable; failing the user's add is not.
  });
}

/** Today's usage for the admin quota widget. */
export async function getQuotaToday(): Promise<{ used: number; limit: number }> {
  const row = await queryOne<{ units_spent: number }>(
    `SELECT units_spent FROM quota_usage WHERE pt_date = $1`,
    [ptDate()],
  );
  return { used: row?.units_spent ?? 0, limit: dailyLimit() };
}
