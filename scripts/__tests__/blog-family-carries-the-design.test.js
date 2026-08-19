/**
 * Every route in the blog family wears the 2a design, not stock DaisyUI (#433, #426).
 *
 * `/blog` was reskinned in #381 and its four siblings were not, so the family read as
 * two different products: a machined shop-floor page that linked to three stock
 * component-library pages. #433 closed that gap; this keeps it closed.
 *
 * WHY A RATCHET AND NOT A SNAPSHOT. #433's own acceptance is "the untouched count must
 * fall and never rise". A snapshot of markup would fail on every legitimate edit and be
 * deleted within a month. What matters is the property: no blog route reverts to bare
 * DaisyUI chrome.
 *
 * COMPOSITION IS NOT A VIOLATION. `globals.css` styles `.card:not(.sh-plate)` and
 * `.stats:not(.sh-well)` — a stock class carrying an `sh-` class beside it is the
 * DESIGNED way to opt into the new look while keeping DaisyUI's layout primitive, and
 * `BlogPostCard` does exactly that (`card sh-plate`). So a file is judged on whether it
 * carries the vocabulary at all, and on chrome classes that have no `sh-` equivalent
 * present anywhere in the file.
 *
 * WHAT THIS CANNOT CHECK: that the result looks right. It asserts the vocabulary is in
 * use, not that it was used tastefully — contrast, overflow and touch targets are the
 * job of the e2e gates, and they enumerate these routes already.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const BLOG = path.join(ROOT, 'src', 'app', 'blog');

/** Chrome classes that mean "stock DaisyUI look", as exact class tokens. */
const STOCK_CHROME = new Set([
  'btn',
  'btn-sm',
  'btn-xs',
  'btn-lg',
  'btn-outline',
  'btn-ghost',
  'btn-primary',
  'badge-outline',
  'badge-lg',
  'card-body',
  'card-title',
  'card-actions',
]);

/** Every `page.tsx` / client component under src/app/blog. */
function blogRouteFiles(dir = BLOG, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) blogRouteFiles(full, out);
    else if (
      /\.tsx$/.test(entry.name) &&
      !/\.(test|stories)\./.test(entry.name)
    )
      out.push(full);
  }
  return out;
}

/**
 * The class tokens a file actually uses.
 *
 * Tokenised on whitespace and compared for EXACT equality, never by substring. A
 * `\bbtn\b` regex matches inside `sh-btn`, because `-` is a word boundary — that
 * false positive cost real time while writing this, and it would have reported a
 * fully-migrated file as still stock.
 */
function classTokens(src) {
  const tokens = new Set();
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    for (const t of (m[1] ?? m[2] ?? '').split(/\s+/)) {
      if (t) tokens.add(t.replace(/^\$\{.*\}$/, ''));
    }
  }
  return tokens;
}

const usesDesign = (t) => [...t].some((c) => c.startsWith('sh-'));
const stockUsed = (t) => [...t].filter((c) => STOCK_CHROME.has(c)).sort();

describe('the blog family carries the 2a design (#433)', () => {
  it('finds the routes, so the assertions below are not vacuous', () => {
    const files = blogRouteFiles();
    assert.ok(
      files.length >= 5,
      `only ${files.length} blog route files found; the walk is broken`
    );
    assert.ok(
      files.some((f) => f.endsWith(path.join('blog', 'page.tsx'))),
      'did not find /blog itself'
    );
  });

  it('no blog route is left on stock chrome', () => {
    const untouched = blogRouteFiles()
      .filter((f) => {
        const t = classTokens(fs.readFileSync(f, 'utf8'));
        // A file with no classes at all is a data/metadata module, not a surface.
        return t.size > 0 && !usesDesign(t);
      })
      .map((f) => path.relative(ROOT, f));

    assert.deepEqual(
      untouched,
      [],
      `These blog routes render chrome but carry no \`sh-\` design token, so they ` +
        `read as a different product from /blog:\n` +
        untouched.map((f) => `  - ${f}`).join('\n') +
        `\n\nUse the vocabulary in globals.css — sh-plate (raised), sh-well (cut), ` +
        `sh-groove (channel), sh-rail (a set of options), sh-btn, sh-doc (article ` +
        `body). #433 closed this gap; the count may fall, never rise.`
    );
  });

  it('no blog route still uses stock button or card-part classes', () => {
    const offenders = blogRouteFiles()
      .map((f) => [
        path.relative(ROOT, f),
        stockUsed(classTokens(fs.readFileSync(f, 'utf8'))),
      ])
      .filter(([, stock]) => stock.length > 0)
      .map(([f, stock]) => `${f}: ${stock.join(', ')}`);

    assert.deepEqual(
      offenders,
      [],
      `Stock DaisyUI chrome left in the blog family:\n` +
        offenders.map((o) => `  - ${o}`).join('\n') +
        `\n\n\`btn-sm\`/\`btn-xs\` also render under the 44px touch floor, so this is ` +
        `not only cosmetic. \`sh-btn\` carries min-height 2.75rem.`
    );
  });

  it('the article body itself carries sh-doc', () => {
    // The single most important change in #433, and the walk above cannot see it:
    // the post body is rendered by BlogPostViewer, which lives under src/components,
    // not src/app/blog. Without this assertion the headline change is unguarded —
    // found because a mutation that stripped sh-doc left every other test green.
    const viewer = fs.readFileSync(
      path.join(
        ROOT,
        'src',
        'components',
        'molecular',
        'BlogPostViewer',
        'BlogPostViewer.tsx'
      ),
      'utf8'
    );
    const tokens = classTokens(viewer);

    assert.ok(
      tokens.has('sh-doc'),
      'BlogPostViewer no longer applies `sh-doc` to the post body. That utility is ' +
        'what gives an article its recessed code panels and real table grid — the ' +
        'same treatment /docs/[slug] uses. Without it a blog post renders as ' +
        'unstyled prose while every other surface is machined.'
    );
  });

  it('the detectors can actually fail', () => {
    // Controls, in both directions — an over-eager version of this check would be
    // deleted by the first person it falsely accused.
    assert.equal(
      usesDesign(classTokens('<a className="sh-btn sh-btn-primary" />')),
      true
    );
    assert.equal(
      usesDesign(classTokens('<a className="btn btn-primary" />')),
      false
    );

    // THE SUBSTRING TRAP: `sh-btn` must not register as the stock `btn`.
    assert.deepEqual(
      stockUsed(classTokens('<a className="sh-btn sh-btn-ghost" />')),
      []
    );
    assert.deepEqual(
      stockUsed(classTokens('<a className="btn btn-ghost" />')),
      ['btn', 'btn-ghost']
    );

    // Composition is legitimate: `card sh-plate` is how globals.css expects a card
    // to opt out of the legacy polish, so it must not be reported as untouched.
    assert.equal(
      usesDesign(classTokens('<div className="card sh-plate" />')),
      true
    );

    // Template-literal classNames are read too, not silently skipped.
    assert.equal(
      usesDesign(classTokens('<div className={`sh-well ${x}`} />')),
      true
    );
  });
});
