/**
 * Seeds one admin, one listener (needed to prove the 403 path), and a handful
 * of tracks. Safe to re-run: existing users are NOT touched.
 *
 * Seed track metadata is PLACEHOLDER — `metadata_fetched_at` is NULL so a
 * refresh overwrites it with authoritative values. The video ids are real so
 * Phase 4 has something that plays; the titles and durations are approximate.
 */
import { Pool } from 'pg';
import { hashPassword } from '../lib/auth/password';

const isProd = process.env.NODE_ENV === 'production';

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    throw new Error(
      `${name} must be set when NODE_ENV=production. Refusing to seed a ` +
        'known-default credential into a real database.',
    );
  }
  return devFallback;
}

const ADMIN_EMAIL = required('SEED_ADMIN_EMAIL', 'admin@example.com');
const ADMIN_PASSWORD = required('SEED_ADMIN_PASSWORD', 'admin-password-1234');
const LISTENER_EMAIL = required('SEED_LISTENER_EMAIL', 'listener@example.com');
const LISTENER_PASSWORD = required('SEED_LISTENER_PASSWORD', 'listener-password-1234');

const TRACKS = [
  { id: 'jNQXAC9IVRw', title: 'Me at the zoo',           channel: 'jawed',       sec: 19 },
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', channel: 'Rick Astley', sec: 213 },
  { id: '9bZkp7q19f0', title: 'Gangnam Style',           channel: 'officialpsy', sec: 253 },
  { id: 'kJQP7kiw5Fk', title: 'Despacito',               channel: 'Luis Fonsi',  sec: 282 },
  { id: 'JGwWNGJdvx8', title: 'Shape of You',            channel: 'Ed Sheeran',  sec: 264 },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });

  // DO NOTHING, not DO UPDATE: re-running must never reset a password that the
  // owner has since changed.
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD), 'Admin'],
  );

  let adminId = admin.rows[0]?.id;
  if (!adminId) {
    const existing = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [ADMIN_EMAIL],
    );
    adminId = existing.rows[0]!.id;
    console.log(`admin    ${ADMIN_EMAIL} already exists — left untouched`);
  } else {
    console.log(`admin    ${ADMIN_EMAIL} created`);
  }

  const listener = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'listener')
     ON CONFLICT (email) DO NOTHING`,
    [LISTENER_EMAIL, await hashPassword(LISTENER_PASSWORD), 'Listener'],
  );
  console.log(
    `listener ${LISTENER_EMAIL} ${listener.rowCount ? 'created' : 'already exists — left untouched'}`,
  );

  if (!isProd) {
    console.log('\n(dev defaults in use; passwords are in scripts/seed.ts)');
  }

  for (const t of TRACKS) {
    await pool.query(
      `INSERT INTO tracks (youtube_id, title, channel_title, duration_sec,
                           thumbnail_url, added_by, metadata_fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (youtube_id) DO NOTHING`,
      [t.id, t.title, t.channel, t.sec, `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg`, adminId],
    );
  }

  const { rows } = await pool.query<{ n: string }>('SELECT count(*)::text AS n FROM tracks');
  console.log(`tracks   ${rows[0]!.n}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
