import { Pool } from 'pg';

/**
 * One pool per process. Neon's *pooled* endpoint sits in front of this, so a
 * small local pool is correct on both sides — see the connection-model note in
 * docs/phase-0-youtube-grounding.md §5.
 */
declare global {
  var __pgPool: Pool | undefined;
}

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  // Test the parsed hostname, not the raw string: a password or database name
  // containing "localhost" would otherwise silently disable TLS.
  let host = '';
  try {
    host = new URL(connectionString).hostname;
  } catch {
    /* leave blank; TLS stays on */
  }
  const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '::1';

  return new Pool({
    connectionString,
    max: 3,
    // Drops idle connections well inside Neon's 5-minute suspend window so
    // they do not hold the compute awake.
    idleTimeoutMillis: 10_000,
    // Neon cold-starts after scale-to-zero; without this a connect can hang
    // on the OS default.
    connectionTimeoutMillis: 10_000,
    // A runaway query would otherwise hold the metered compute awake.
    statement_timeout: 15_000,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
  });
}

export const pool: Pool = globalThis.__pgPool ?? makePool();
if (process.env.NODE_ENV !== 'production') globalThis.__pgPool = pool;

/** Parameterised only — there is no string-concatenation path into SQL. */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params as unknown[]);
  return result.rows as T[];
}

export async function queryOne<T extends Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Runs `fn` on a single checked-out connection inside a transaction.
 *
 * `query()` grabs an arbitrary pooled connection per call, so it cannot be
 * used for multi-statement work — a bare `query('BEGIN')` would open a
 * transaction on a random connection and leak it. Phase 5's drag-to-reorder
 * needs this.
 */
export async function withTransaction<T>(
  fn: (client: {
    query: <R extends Record<string, unknown>>(
      text: string,
      params?: readonly unknown[],
    ) => Promise<R[]>;
  }) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn({
      query: async <R extends Record<string, unknown>>(
        text: string,
        params: readonly unknown[] = [],
      ) => (await client.query(text, params as unknown[])).rows as R[],
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
