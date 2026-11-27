/**
 * The band overlay must rebuild the blog index after it copies the band's blog post in.
 *
 * src/lib/blog/blog-data.json is tracked and generated from public/blog. This public repository
 * carries no band post, so the committed index has no entry for it, and the overlay only copies
 * the post's markdown file. Without a rebuild the site's build never generates the post's page:
 * /blog/the-band-wagon-house-band/ answers 404 while every check stays green. That is exactly how
 * the first deploy after the band moved to a private repository shipped it.
 *
 * Comments are stripped before matching, because the step's own comment names the generator.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const OVERLAY = path.join(ROOT, 'scripts', 'ci', 'band-overlay.sh');

const code = fs
  .readFileSync(OVERLAY, 'utf8')
  .split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n');

describe('band-overlay.sh rebuilds the blog index', () => {
  it('runs the blog generator, only when the overlay carries a blog post', () => {
    assert.match(
      code,
      /if \[ -d "\$work\/band\/overlay\/public\/blog" \]; then\s+node scripts\/generate-blog-data\.js\s+fi/
    );
  });

  it('runs it after the overlay files are copied in', () => {
    const copy = code.indexOf('cp -a "$work/band/overlay/." .');
    const generate = code.indexOf('node scripts/generate-blog-data.js');
    assert.ok(copy >= 0, 'band-overlay.sh no longer copies the overlay in');
    assert.ok(
      generate > copy,
      'the blog index must be rebuilt after the overlay is copied'
    );
  });
});
