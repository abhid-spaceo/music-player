import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id. Parameters are OWASP's second recommended profile (19 MiB, t=2,
 * p=1), which keeps a single hash near ~50ms — deliberately slow for an
 * attacker, and cheap enough against Vercel Hobby's 4 CPU-hour Active CPU
 * allowance at this user count (see phase-0 §1.3).
 *
 * @node-rs/argon2 ships prebuilt native binaries for Vercel's runtime, which
 * the plain `argon2` package does not reliably do.
 */
// The algorithm is left at the library default, verified to be argon2id by
// inspecting the hash prefix rather than trusting the docs. Naming the
// `Algorithm` enum explicitly would drag an ambient const enum into a build
// that runs with isolatedModules.
const OPTIONS = {
  memoryCost: 19_456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/**
 * A real Argon2id hash of a value nobody can supply, used to spend the same
 * ~25ms of CPU when the email does not exist. Without this, an unknown email
 * returns an order of magnitude faster than a known one and the login route
 * becomes a timing-based account enumerator.
 */
let dummyHash: Promise<string> | null = null;
export function burnPasswordWork(plain: string): Promise<boolean> {
  dummyHash ??= hash('not-a-real-password-placeholder', OPTIONS);
  return dummyHash.then((h) => verifyPassword(h, plain));
}

/** False on any malformed hash rather than throwing, so a corrupt row cannot
 *  500 the login route. */
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    // Parameters come from the encoded hash itself, so passing OPTIONS here
    // would be ignored and would wrongly imply that changing them breaks
    // existing hashes.
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}
