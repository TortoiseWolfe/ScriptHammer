/**
 * Load `auth-config.json`, resolving `${VAR:-default}` against the environment (#734).
 *
 * WHY THIS EXISTS. `auth-config.json` is the checked-in DESIRED STATE that
 * `auth-config-drift.yml` compares the live Supabase project against, daily and on
 * every push to main. It held eight values specific to this instance — site URL,
 * allow-list, SMTP host/user/sender, and both OAuth client ids — and nothing
 * rewrote them on fork. So a fork inherited ScriptHammer's identity as its
 * *declared correct configuration*, and the gate then reported drift against values
 * that were never theirs. Their options were to edit the file or stop believing the
 * gate; both are bad, and the second is worse.
 *
 * WHY NOT JUST READ THE VALUES FROM ENV. Because that breaks what the gate is for.
 * It compares LIVE prod against a value **pinned in the repo**. If the expected value
 * came from the runner's environment, both sides could drift together and the check
 * could never fire — and #287 is precisely "prod drifted while every test stayed
 * green". `${VAR:-default}` keeps a pinned default so ScriptHammer's own gate still
 * detects real drift, while letting a fork declare its own expectation in CI without
 * editing the file.
 *
 * WHAT A FORK THAT CONFIGURES NOTHING GETS: the ScriptHammer defaults, and a gate
 * that fails LOUDLY against their project. That is the correct outcome — it tells
 * them to configure rather than passing silently. Silence is the failure mode this
 * whole file exists to remove.
 *
 * CommonJS on purpose: `scripts/__tests__/canonical-artifacts.test.js` is
 * `node:test` + `require`, `tests/unit/auth-config-validity.test.ts` is Vitest, and
 * `set-auth-config.ts` runs under tsx. One CJS module serves all three, and a single
 * shared loader is the only way the pinned file and the three readers cannot
 * disagree about what the desired state actually is.
 */

const { readFileSync } = require('node:fs');

/**
 * Every `${VAR}` / `${VAR:-default}` occurrence in `text`, resolved against `env`.
 *
 * Deliberately narrow: this is not a shell. It supports exactly the `:-` form that
 * CLAUDE.md already prescribes for committed files, and leaves anything else alone
 * rather than guessing. An unknown construct surviving verbatim will fail JSON
 * parsing or the validity assertions loudly, which beats a silent empty string.
 *
 * @param {string} text
 * @param {Record<string, string|undefined>} [env]
 * @returns {string}
 */
function interpolate(text, env = process.env) {
  return text.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g,
    (_match, name, fallback) => {
      const value = env[name];
      // An env var set to the EMPTY STRING falls back rather than blanking the
      // field. CI commonly exports unset inputs as '', and an empty site_url in
      // the desired state would make the drift gate demand that prod be blank.
      if (value !== undefined && value !== '') return value;
      return fallback !== undefined ? fallback : '';
    }
  );
}

/**
 * Read and parse the desired-state config, with interpolation applied first.
 *
 * @param {string} path
 * @param {Record<string, string|undefined>} [env]
 * @returns {Record<string, unknown>}
 */
function loadAuthConfig(path, env = process.env) {
  const raw = readFileSync(path, 'utf8');
  const resolved = interpolate(raw, env);
  try {
    return JSON.parse(resolved);
  } catch (err) {
    // Name the interpolation explicitly: an unresolved or malformed substitution
    // produces a parse error whose message otherwise points at a column number in
    // a file that looks perfectly valid on disk.
    throw new Error(
      `Could not parse ${path} after \${VAR:-default} interpolation: ` +
        `${err.message}. Check for an unterminated \${...} or a value containing ` +
        `an unescaped quote.`
    );
  }
}

/**
 * The keys a fork is expected to override, and the env var each reads.
 *
 * Exported so `rebrand.sh` and the tests name the same set rather than three
 * hand-maintained copies drifting apart — the shape of omission that put
 * CRUDkit's monogram on a live client site (#659).
 */
const FORK_OVERRIDABLE = Object.freeze({
  site_url: 'AUTH_SITE_URL',
  uri_allow_list: 'AUTH_URI_ALLOW_LIST',
  smtp_host: 'AUTH_SMTP_HOST',
  smtp_user: 'AUTH_SMTP_USER',
  smtp_admin_email: 'AUTH_SMTP_ADMIN_EMAIL',
  smtp_sender_name: 'AUTH_SMTP_SENDER_NAME',
  external_github_client_id: 'AUTH_GITHUB_CLIENT_ID',
  external_google_client_id: 'AUTH_GOOGLE_CLIENT_ID',
});

module.exports = { interpolate, loadAuthConfig, FORK_OVERRIDABLE };
