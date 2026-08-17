/**
 * A spec that creates a group through the UI must delete it again (#612).
 *
 * WHAT HAPPENED. `group-chat-multiuser.spec.ts` drives the New Group page twice —
 * that flow is what those tests exist to exercise — so no fixture object holds the
 * resulting conversation id and `deleteIsolatedGroup` cannot reach them. Nothing
 * deleted them. Production reached **1,910 conversations for 20 users**; 1,909 were
 * E2E artifacts with zero messages, created at roughly two per CI run and peaking
 * at 157 on the day the project hit its quota ceiling. Every row is published to
 * realtime, which fed the `exceed_realtime_message_count_quota` violation in #567.
 *
 * WHY A STRUCTURAL GUARD RATHER THAN TRUSTING THE RUNTIME ASSERTION. The spec's
 * `afterAll` now deletes and then asserts nothing survived, which is the real
 * check — but it only covers group names that were RECORDED. Someone adding a
 * third `#group-name` fill without wrapping it would leak again, silently, and the
 * runtime assertion would still pass because it never knew about that name. That
 * is the same shape as the original defect: the suite passed every time while
 * leaking, so "the tests are green" was never evidence of tear-down.
 *
 * This runs in `pnpm test:scripts` — no browser, no database, no E2E lane needed.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const E2E_DIR = path.join(__dirname, '..', '..', 'tests', 'e2e');

/** Every `.spec.ts` under tests/e2e, recursively. */
function specFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...specFiles(full));
    else if (entry.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

/** Specs that create a group by typing into the New Group form. */
function specsCreatingGroupsViaUi() {
  return specFiles(E2E_DIR).filter((file) =>
    fs.readFileSync(file, 'utf8').includes("'#group-name'")
  );
}

test('the detector can see the spec it was written for (no silent no-op)', () => {
  // Without this, a renamed selector or moved directory makes every assertion
  // below vacuous — they would iterate an empty list and pass (#396).
  const specs = specsCreatingGroupsViaUi();

  assert.ok(
    specs.length > 0,
    'found no spec filling #group-name; the selector or path probably changed, ' +
      'so this guard is no longer watching anything — verify by hand before ' +
      'deleting it'
  );
});

test('every spec that creates a group via the UI also tears it down', () => {
  for (const file of specsCreatingGroupsViaUi()) {
    const src = fs.readFileSync(file, 'utf8');
    // A CALL, not merely the identifier. Checking `includes(name)` also matched
    // the import line, so deleting the actual call left this assertion green —
    // found by mutating the spec, which is the only reason it is written this way.
    assert.match(
      src,
      /deleteConversationsByGroupName\s*\(/,
      `${path.relative(process.cwd(), file)} fills #group-name but never CALLS ` +
        `deleteConversationsByGroupName. A UI-created group has no fixture id, so ` +
        `deleteIsolatedGroup cannot reach it and the row is permanent (#612).`
    );
  }
});

test('every #group-name fill is recorded for tear-down', () => {
  // The precise regression: a third creation site added without wrapping it. The
  // runtime assertion in afterAll cannot catch that, because it only knows the
  // names it was told about.
  for (const file of specsCreatingGroupsViaUi()) {
    const src = fs.readFileSync(file, 'utf8');
    const fills = src.match(/'#group-name'\s*\)\s*\n?\s*\.fill\(/g) ?? [];
    // Lookbehind excludes the DECLARATION — `function recordUiGroup(` is not a
    // call site, and counting it made this assertion read 3-vs-2 on a correct
    // file. Caught by the guard itself on first run.
    const recorded = src.match(/(?<!function )recordUiGroup\(/g) ?? [];

    assert.equal(
      recorded.length,
      fills.length,
      `${path.relative(process.cwd(), file)} has ${fills.length} #group-name ` +
        `fill(s) but ${recorded.length} recordUiGroup() call(s). Every group ` +
        `created through the UI must be recorded, or afterAll deletes only the ` +
        `ones it happens to know about and the rest leak silently (#612).`
    );
  }
});
