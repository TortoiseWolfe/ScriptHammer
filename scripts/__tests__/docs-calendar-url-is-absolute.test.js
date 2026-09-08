/**
 * No document may show `NEXT_PUBLIC_CALENDAR_URL` as a bare `user/event` slug.
 *
 * WHY THIS IS WORTH A TEST. `docs/features/calendar-integration.md` told Cal.com adopters to set
 * `NEXT_PUBLIC_CALENDAR_URL=your-username/meeting`. That value makes `/schedule` work — the embed
 * wants a path, and `toCalLink` passes an already-bare value straight through (#1100) — while
 * `buildBookingUrl` calls `new URL(base)`, throws, and returns `null`.
 *
 * So the forker configures it, opens `/schedule`, sees a working calendar, and ships. The link
 * that disappears is the one shown to somebody who has just paid, on a page nobody looks at
 * until a customer is standing on it. **The visible surface confirms the setting while the
 * paid surface is deleted by it.**
 *
 * `.env.example:91-103` has said "always a FULL URL, for BOTH providers" since #1100. The doc
 * that `docs/FORK-CHECKLIST.md` sends forkers to said the opposite. Two files a fork copies,
 * disagreeing about the one value that decides whether a paid customer gets a booking link.
 *
 * WHAT IT DOES NOT CATCH, said plainly: a doc that omits the variable entirely, or describes it
 * in prose without an assignment. It checks the shape of every assignment it can find, which is
 * the form a reader copies.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');

/** Every tracked markdown file, plus `.env.example`, which is the other thing forks copy. */
function docFiles(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      e.name === 'node_modules' ||
      e.name === '.next' ||
      e.name === 'out' ||
      // Build outputs, not sources. `out-basepath/` is a generated copy of the site; fixing a
      // doc there fixes nothing and the copy reappears on the next build.
      e.name.startsWith('out-') ||
      e.name === 'storybook-static' ||
      e.name === 'coverage' ||
      e.name.startsWith('.git')
    ) {
      continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) docFiles(full, out);
    else if (e.name.endsWith('.md') || e.name === '.env.example')
      out.push(full);
  }
  return out;
}

/**
 * Assignments of a calendar URL variable, with the value as written.
 *
 * Commented-out lines count: `.env.example` ships every variable commented, and a reader
 * uncomments rather than retypes, so a wrong value there is exactly as harmful.
 */
function calendarUrlAssignments() {
  const found = [];
  for (const file of docFiles()) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(
      /^[#\s>-]*\b(NEXT_PUBLIC_CALENDAR_URL(?:_[A-Z_]+)?)\s*=\s*(\S+)/gm
    )) {
      found.push({
        file: path.relative(ROOT, file),
        name: m[1],
        value: m[2].replace(/[`'"]/g, ''),
      });
    }
  }
  return found;
}

describe('documented calendar URLs are absolute (#1100)', () => {
  it('finds assignments to check, so the sweep is not vacuous', () => {
    // ANTI-VACUITY. A path or regex mistake would make the assertion below pass by inspecting
    // nothing — which is the same silent-green failure the doc defect itself had.
    const found = calendarUrlAssignments();
    assert.ok(
      found.length >= 2,
      `only ${found.length} calendar-URL assignment(s) found across the docs — the sweep is ` +
        'broken, not the documentation'
    );
  });

  it('every documented value is a full URL, never a bare slug', () => {
    const bare = calendarUrlAssignments()
      .filter((a) => !/^https?:\/\//i.test(a.value))
      .map((a) => `${a.file}: ${a.name}=${a.value}`);

    assert.deepStrictEqual(
      bare,
      [],
      'A document shows a calendar URL as a bare slug. That value makes /schedule work and ' +
        'silently deletes the booking link shown after a purchase: the embed takes a path, but ' +
        '`buildBookingUrl` calls `new URL()` and returns null when it throws.\n\n' +
        'Use the full URL — `https://cal.com/<user>/<event>` — for both providers. ' +
        '`toCalLink` derives the embed path from it (#1100).\n\n' +
        `Offenders:\n  ${bare.join('\n  ')}`
    );
  });

  it('the matcher accepts a full URL and rejects a bare slug', () => {
    // Counterweight, so the rule cannot later be "fixed" by loosening the pattern until a bare
    // slug passes. Both directions, because only checking the accept case proves nothing.
    const abs = /^https?:\/\//i;
    assert.ok(abs.test('https://cal.com/turtle-wolfe/office-hours'));
    assert.ok(!abs.test('your-username/meeting'));
  });
});
