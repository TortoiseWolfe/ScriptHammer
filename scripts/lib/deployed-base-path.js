/**
 * The base path the DEPLOYED site serves from — the one the tracked `public/manifest.json`
 * must agree with (#1114).
 *
 * WHY THIS IS A SHARED MODULE AND NOT TWO COPIES. `scripts/__tests__/generated-manifest.test.js`
 * already computed this rule to decide what the committed artifact should say, and
 * `generate-manifest.js` now needs the same answer to decide whether writing would corrupt
 * that artifact. Two copies of a rule that must agree is precisely the drift this repo keeps
 * getting bitten by — the `e2e-local` ignore list is derived from `e2e.yml` for the same
 * reason (#575), rather than maintained twice.
 *
 * READ FROM CONFIGURATION, NOT FROM `public/CNAME` (#980). That file is generated and
 * gitignored, so it is absent on the clean checkout CI runs on. Keying off it flipped the
 * expectation to `/ScriptHammer/` while the committed manifest correctly said `/`, and
 * deadlocked the required `Test (20.x)` check on every PR. It has happened once already
 * (#931); do not reintroduce it.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * @param {string} root repository root; defaults to this repo.
 * @returns {string} '' for a custom domain, otherwise '/<project>'. Never a trailing slash.
 */
function deployedBasePath(root = REPO_ROOT) {
  // A custom domain serves from the apex, so there is no base path to add.
  try {
    const deployment = JSON.parse(
      fs.readFileSync(path.join(root, 'config', 'deployment.json'), 'utf8')
    );
    if (deployment.customDomain) return '';
  } catch {
    /* no deployment config: fall through to the project-site rules below */
  }

  // The env override wins in detect-project.js:74, so it wins here too.
  const override = process.env.NEXT_PUBLIC_PROJECT_NAME;
  if (override) return `/${override}`;

  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    const slug = remote
      .replace(/\.git$/, '')
      .split(/[/:]/)
      .pop();
    return slug ? `/${slug}` : '';
  } catch {
    // No git remote (a tarball checkout, a fresh init). An empty base path is the safe
    // answer: it matches the apex case, and a caller comparing for divergence will simply
    // see none rather than redirecting a write it should not redirect.
    return '';
  }
}

/** Normalise for comparison: '' and '/' mean the same thing; trailing slashes do not count. */
function normaliseBasePath(value) {
  const v = (value || '').trim();
  if (!v || v === '/') return '';
  return v.replace(/\/+$/, '');
}

module.exports = { deployedBasePath, normaliseBasePath, REPO_ROOT };
