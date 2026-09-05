/**
 * Pure quota-date helpers, kept free of any DB import so they load (and unit
 * test) without a DATABASE_URL. The store lives in `./quota.ts`.
 *
 * YouTube Data API quota resets at midnight US Pacific, so usage is bucketed by
 * the Pacific calendar date — a new date is a fresh bucket, making the daily
 * reset implicit.
 */

const PACIFIC = 'America/Los_Angeles';

/**
 * The Pacific-time calendar date (YYYY-MM-DD) for an instant. `en-CA` formats as
 * ISO date; the `timeZone` does the UTC→PT shift, DST included. Injectable
 * `now` so the day-boundary behaviour is unit-testable.
 */
export function ptDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Daily allowance. Configurable; YouTube's default project quota is 10,000. */
export function dailyLimit(): number {
  const raw = Number(process.env.YOUTUBE_DAILY_QUOTA);
  return Number.isFinite(raw) && raw > 0 ? raw : 10_000;
}
