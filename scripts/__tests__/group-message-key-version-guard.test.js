/**
 * The server refuses a group message under a stale key version, and the client knows its
 * wording (#1301, #1247 B3).
 *
 * Removing a group member moves `conversations.current_key_version` forward. A message sent
 * under an older version is readable by every removed member who still holds that key, so the
 * server has to refuse it. The offline queue then recognises the refusal by a phrase and
 * re-encrypts instead of dropping the message. This test pins both halves to the same phrase:
 * rewording one side would turn a recoverable refusal into a lost message with every check
 * still green.
 *
 * The behaviour itself (stale refused, current accepted) is proven against a real database by
 * tests/rls/group-stale-key-version.test.ts in the Conformance lane. This file is the cheap
 * guard that notices the section being removed, widened or reworded on a machine with no
 * database.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const SQL = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20251006_complete_monolithic_setup.sql'),
  'utf8'
);
const QUEUE = fs.readFileSync(
  path.join(ROOT, 'src/services/messaging/offline-queue-service.ts'),
  'utf8'
);

const BANNER = 'GROUP MESSAGES MUST USE THE CURRENT KEY VERSION';
const PHRASE = 'stale group key version';

/** The section: from its banner to the next banner (what apply-migration-section.mjs runs). */
function section() {
  const rule = /^-- ={10,}\s*$/;
  const lines = SQL.split('\n');
  const start = lines.findIndex(
    (l, i) => rule.test(l) && lines[i + 1] === `-- ${BANNER}`
  );
  assert.notStrictEqual(start, -1, `banner "${BANNER}" not found`);
  let end = lines.length;
  for (let i = start + 3; i < lines.length - 2; i++) {
    if (
      rule.test(lines[i]) &&
      !rule.test(lines[i + 1]) &&
      rule.test(lines[i + 2])
    ) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

test('the banner is unique, so the apply workflow can find exactly one section', () => {
  assert.strictEqual(SQL.split(`-- ${BANNER}`).length - 1, 1);
});

test('the section stays small: it must not swallow a neighbour and re-run it in production', () => {
  assert.ok(section().split('\n').length < 100);
});

test('a BEFORE INSERT OR UPDATE trigger on messages runs the guard function', () => {
  const s = section();
  assert.match(
    s,
    /DROP TRIGGER IF EXISTS group_message_key_version_guard ON messages;/
  );
  assert.match(
    s,
    /CREATE TRIGGER group_message_key_version_guard\s+BEFORE INSERT OR UPDATE OF encrypted_content, initialization_vector, key_version ON messages\s+FOR EACH ROW EXECUTE FUNCTION enforce_group_message_key_version\(\);/
  );
});

test('an UPDATE that leaves the ciphertext and version alone passes (mark-read, delivered, soft-delete)', () => {
  const s = section();
  assert.match(
    s,
    /IF TG_OP = 'UPDATE'\s+AND NEW\.encrypted_content IS NOT DISTINCT FROM OLD\.encrypted_content\s+AND NEW\.initialization_vector IS NOT DISTINCT FROM OLD\.initialization_vector\s+AND NEW\.key_version IS NOT DISTINCT FROM OLD\.key_version\s+THEN\s+RETURN NEW;/
  );
});

test('the guard refuses with 42501 and the phrase the client matches on', () => {
  const s = section();
  assert.ok(s.includes(`RAISE EXCEPTION '${PHRASE}`), 'refusal text changed');
  assert.match(s, /USING ERRCODE = '42501'/);
});

test('the guard compares against the conversation current version, for groups only', () => {
  const s = section();
  assert.match(
    s,
    /SELECT c\.current_key_version INTO v_cur\s+FROM conversations c WHERE c\.id = NEW\.conversation_id AND c\.is_group;/
  );
  assert.match(s, /NEW\.key_version IS DISTINCT FROM v_cur/);
});

test('the service role is exempt only with no uid, so a forged role claim cannot reach it', () => {
  const s = section();
  assert.match(
    s,
    /IF v_uid IS NULL\s+AND \(v_role IS NULL\s+OR v_role IN \('service_role', 'supabase_admin', 'supabase_auth_admin', 'postgres'\)\)/
  );
});

test('system messages are exempt: group-service writes them after the rotation, with no key version', () => {
  assert.match(
    section(),
    /IF NEW\.is_system_message IS TRUE THEN\s+RETURN NEW;/
  );
});

test('the function is SECURITY DEFINER with a fixed search_path', () => {
  const s = section();
  assert.match(
    s,
    /enforce_group_message_key_version\(\)\s+RETURNS TRIGGER\s+SECURITY DEFINER\s+SET search_path = public/
  );
});

test('the offline queue matches the same phrase the server raises', () => {
  assert.ok(
    QUEUE.includes(PHRASE),
    `offline-queue-service.ts no longer recognises "${PHRASE}"; the server refusal would drop queued messages`
  );
});
