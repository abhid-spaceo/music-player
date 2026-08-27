/**
 * Sets a user's password.
 *
 *   npm run set-password -- <email> <password>
 *
 * Bumps `session_version`, which invalidates every outstanding cookie for that
 * user. A password change that leaves old sessions working is not a password
 * change — and the sessions are stateless, so the counter is the only lever.
 */
import { Pool } from 'pg';
import { hashPassword } from '../lib/auth/password';

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    throw new Error('Usage: npm run set-password -- <email> <password>');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });

  const updated = await pool.query<{ email: string; role: string; session_version: number }>(
    `UPDATE users
        SET password_hash = $2, session_version = session_version + 1,
            failed_login_count = 0, locked_until = NULL
      WHERE email = $1
      RETURNING email, role, session_version`,
    [email, await hashPassword(password)],
  );

  if (updated.rowCount === 0) {
    await pool.end();
    throw new Error(`No user with email ${email}`);
  }

  const row = updated.rows[0]!;
  console.log(`updated ${row.email} (${row.role})`);
  console.log(`  session_version -> ${row.session_version}  (all existing sessions invalidated)`);
  console.log(`  failed-login counter and any lock cleared`);

  if (password.length < 12) {
    console.log(
      `\n  note: ${password.length} characters. The admin user-creation route requires 12+,\n` +
        `  so this password could not be set through the API. Fine for local use;\n` +
        `  pick something longer for a deployed instance.`,
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
