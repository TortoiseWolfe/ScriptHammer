/**
 * Read a required environment variable, or fail loudly.
 *
 * The seeded test-user passwords are never stored in the repository (#1246): CI makes a random
 * one per run, and `pnpm run use:local` puts one in your gitignored `.env`. A test that needs
 * one therefore has no safe default to fall back on, so a missing value is an error, not a
 * guess. The message names the variable and never prints a value.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run \`pnpm run use:local\` (fills it in .env), or export it before running this test.`
    );
  }
  return value;
}
