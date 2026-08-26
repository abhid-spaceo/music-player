/**
 * Applies db/migrations/*.sql in filename order, once each, inside a
 * transaction. Tracked in schema_migrations so re-runs are no-ops.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

const dir = join(process.cwd(), 'db', 'migrations');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      checksum   text,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text');

  const applied = new Map(
    (
      await pool.query<{ filename: string; checksum: string | null }>(
        'SELECT filename, checksum FROM schema_migrations',
      )
    ).rows.map((r) => [r.filename, r.checksum]),
  );

  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);

    if (applied.has(file)) {
      const recorded = applied.get(file);
      // Editing an already-applied migration is the obvious move on a
      // one-developer project, and it diverges local from production
      // silently. Make it loud instead.
      if (recorded && recorded !== checksum) {
        throw new Error(
          `${file} has changed since it was applied (recorded ${recorded}, now ` +
            `${checksum}). Add a new migration instead of editing this one.`,
        );
      }
      if (!recorded) {
        await pool.query('UPDATE schema_migrations SET checksum = $2 WHERE filename = $1', [
          file,
          checksum,
        ]);
      }
      console.log(`  skip  ${file}`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [file, checksum],
      );
      await client.query('COMMIT');
      console.log(`  apply ${file}`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAIL  ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`\n${ran} applied, ${files.length - ran} already present.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
