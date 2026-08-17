/**
 * `auth-config.json` is the desired state a daily gate compares live prod against,
 * and it now carries `${VAR:-default}` so a fork can declare its own expectation
 * without editing a file it is meant to reuse (#734).
 *
 * Two things have to hold at once, and they pull in opposite directions:
 *
 *   1. ScriptHammer's own gate must still detect real drift — so the DEFAULT has to
 *      survive interpolation exactly, byte for byte. If interpolation quietly
 *      changed a pinned value, the gate would start reporting drift that is not
 *      there, and the first response to a noisy gate is to stop believing it.
 *   2. A fork's override must actually take effect — otherwise this whole change is
 *      decoration and the fork is back to editing the file by hand.
 *
 * The two structural tests at the bottom are the ones that will still be earning
 * their keep in a year. They pin FORK_OVERRIDABLE to the two things that have to
 * agree with it — the config file that declares the placeholders, and the workflow
 * that feeds them to the runner. A key added to one and not the others is exactly
 * the omission that let CRUDkit's monogram reach a live client site (#659), and the
 * workflow half is where it hides best: everything reads as configurable, and the
 * runner simply never receives the values.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  interpolate,
  loadAuthConfig,
  FORK_OVERRIDABLE,
} = require('../supabase/auth-config-loader.js');

const CONFIG_PATH = path.join(__dirname, '..', 'supabase', 'auth-config.json');
const WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  '..',
  '.github',
  'workflows',
  'auth-config-drift.yml'
);

function tmpJson(contents) {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'auth-config-')),
    'auth-config.json'
  );
  fs.writeFileSync(file, contents);
  return file;
}

// ── interpolate ─────────────────────────────────────────────────────────────

test('an unset var falls back to its default', () => {
  assert.equal(interpolate('${A:-fallback}', {}), 'fallback');
});

test('a set var wins over the default', () => {
  assert.equal(interpolate('${A:-fallback}', { A: 'mine' }), 'mine');
});

test('an EMPTY env var falls back rather than blanking the field', () => {
  // CI commonly exports an unset input as ''. An empty site_url in the desired
  // state would make the gate demand that production be blank — a guard actively
  // asserting the wrong thing is worse than one that is merely absent.
  assert.equal(interpolate('${A:-fallback}', { A: '' }), 'fallback');
});

test('a var with no default resolves to empty when unset', () => {
  assert.equal(interpolate('${A}', {}), '');
});

test('leaves unrelated text and unknown constructs alone', () => {
  // Not a shell. Anything beyond `:-` survives verbatim so it fails loudly at JSON
  // parse or in the validity assertions, rather than being guessed at.
  assert.equal(interpolate('plain', {}), 'plain');
  assert.equal(interpolate('${A:?err}', { A: 'x' }), '${A:?err}');
  assert.equal(interpolate('$NOT_BRACED', { NOT_BRACED: 'x' }), '$NOT_BRACED');
});

test('resolves every occurrence, not just the first', () => {
  assert.equal(interpolate('${A:-1}/${A:-1}/${B:-2}', {}), '1/1/2');
});

// ── loadAuthConfig ──────────────────────────────────────────────────────────

test('parses after interpolating', () => {
  const file = tmpJson('{"site_url": "${S:-https://d.example}", "n": 1}');
  assert.deepEqual(loadAuthConfig(file, {}), {
    site_url: 'https://d.example',
    n: 1,
  });
  assert.equal(
    loadAuthConfig(file, { S: 'https://fork.example' }).site_url,
    'https://fork.example'
  );
});

test('a parse failure names the interpolation instead of a bare column number', () => {
  // Must be JSON that breaks ONLY AFTER substitution — that is the case whose error
  // message is otherwise baffling, because the file reads as valid on disk. (An
  // earlier version of this test used `"${UNTERMINATED"`, which is perfectly valid
  // JSON — the string is simply `${UNTERMINATED` — so nothing threw and the test
  // was asserting nothing.)
  const file = tmpJson('{"a": ${N:-notjson}}');
  assert.throws(() => loadAuthConfig(file, {}), /interpolation/);
});

// ── the real file ───────────────────────────────────────────────────────────

test('the committed defaults resolve to a valid config with an EMPTY env', () => {
  // What a fork inherits before configuring anything, and what ScriptHammer's own
  // gate compares prod against.
  const config = loadAuthConfig(CONFIG_PATH, {});

  assert.match(config.site_url, /^https:\/\//);
  assert.doesNotMatch(config.site_url, /\$\{/, 'no unresolved placeholder');
  assert.equal(config.smtp_host, 'smtp.resend.com');
  assert.ok(config.external_github_client_id.length > 5);
});

test('no value in the resolved config still contains a ${...} placeholder', () => {
  // The failure this catches: a new `${VAR}` added with a typo'd name or a missing
  // default, which JSON-parses fine and then ships a literal `${…}` into the
  // desired state — where it would be compared against prod and always drift.
  const config = loadAuthConfig(CONFIG_PATH, {});

  for (const [key, value] of Object.entries(config)) {
    if (typeof value !== 'string') continue;
    assert.doesNotMatch(
      value,
      /\$\{/,
      `${key} still holds an unresolved placeholder: ${value}`
    );
  }
});

test('FORK_OVERRIDABLE and the file cannot drift apart', () => {
  // Both directions. A key in the map that the file does not parameterise is a
  // promise the fork cannot use; a parameterised key missing from the map is one
  // rebrand.sh and the docs will never mention.
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const parameterised = new Set(
    [...raw.matchAll(/"([a-z_]+)":\s*"\$\{([A-Z_]+)(?::-[^}]*)?\}"/g)].map(
      (m) => m[1]
    )
  );

  assert.deepEqual(
    [...parameterised].sort(),
    Object.keys(FORK_OVERRIDABLE).sort(),
    'every parameterised key must appear in FORK_OVERRIDABLE and vice versa'
  );

  // And each one must read the var the map claims it does.
  for (const [key, varName] of Object.entries(FORK_OVERRIDABLE)) {
    const resolved = loadAuthConfig(CONFIG_PATH, { [varName]: 'SENTINEL' });
    assert.equal(resolved[key], 'SENTINEL', `${key} does not read ${varName}`);
  }
});

test('the drift workflow passes every FORK_OVERRIDABLE var to the runner', () => {
  // The half that makes the other half real. `set-auth-config.ts` resolves the
  // desired state against `process.env`, and GitHub does NOT put `vars.*` there on
  // its own — a step sees only what its `env:` block names. Miss this and a fork can
  // set all eight repository Variables exactly as rebrand.sh instructs and still be
  // measured against ScriptHammer's defaults, with nothing anywhere reporting why.
  //
  // Asserted from the workflow TEXT rather than by running it, because the failure is
  // a silent omission: there is no run in which a missing env line announces itself.
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  const passed = new Map(
    [
      ...workflow.matchAll(
        /^\s+(AUTH_[A-Z_]+):\s*\$\{\{\s*vars\.([A-Z_]+)\s*\}\}/gm
      ),
    ].map((m) => [m[1], m[2]])
  );

  assert.deepEqual(
    [...passed.keys()].sort(),
    Object.values(FORK_OVERRIDABLE).sort(),
    'auth-config-drift.yml must pass exactly the FORK_OVERRIDABLE vars — no more, no fewer'
  );

  // A copy-pasted line pointing at the wrong Variable resolves to '', which
  // `interpolate` treats as unset, so the field silently falls back to the
  // ScriptHammer default and the gate reads as passing.
  for (const [envName, varName] of passed) {
    assert.equal(
      varName,
      envName,
      `${envName} reads vars.${varName} — the names must match or the override is dropped`
    );
  }
});
