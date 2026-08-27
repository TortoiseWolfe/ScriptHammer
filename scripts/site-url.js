/**
 * Resolve the canonical deployment origin for static build artifacts.
 *
 * Sitemap and feed generators must agree with the application rather than
 * each keeping a subtly different GitHub Pages fallback (#479, #666). The app
 * prioritizes NEXT_PUBLIC_DEPLOY_URL, so these emitted artifacts must too.
 *
 * This intentionally does not derive an origin from public/CNAME: that file
 * uses www.scripthammer.com while the canonical application origin is the
 * apex. A generated URL at the wrong host is the same SEO failure in a new
 * place. The fallback keeps forks working when they have not set a custom
 * domain, and callers print its source so the fallback is visible in build
 * logs rather than silently shipping the wrong origin.
 */
/** The repository name detect-project.js derived from the git remote, if it ran. */
function detectedProjectName() {
  try {
    const { readFileSync } = require('node:fs');
    const path = require('node:path');
    const file = path.join(
      __dirname,
      '..',
      'src',
      'config',
      'project-detected.json'
    );
    return JSON.parse(readFileSync(file, 'utf8')).projectName || '';
  } catch {
    return '';
  }
}

function resolveSiteUrl(env = process.env) {
  const explicit = env.NEXT_PUBLIC_DEPLOY_URL;
  if (explicit && explicit.trim()) {
    return {
      url: explicit.trim().replace(/\/+$/, ''),
      source: 'NEXT_PUBLIC_DEPLOY_URL',
    };
  }

  const owner = (
    env.NEXT_PUBLIC_PROJECT_OWNER || 'TortoiseWolfe'
  ).toLowerCase();
  // DETECTED, not guessed (#962).
  //
  // This segment is a GitHub Pages project path, and those are CASE-SENSITIVE —
  // verified live: tortoisewolfe.github.io/ScriptHammer/ is 200 and /scripthammer/
  // is 404. So it must be the repository's actual name; neither the display name
  // nor a slugified approximation of it will do.
  //
  // The hardcoded literal was the broken part: a rebrand rewrites it, and rewrites
  // it to the fork's DISPLAY name. A fork called "Widget" with a `widget` repo
  // shipped a sitemap and robots.txt full of /Widget/ URLs, every one a 404.
  //
  // detect-project.js resolves this from the git remote and runs FIRST in
  // `prebuild`, before generate-sitemap and generate-rss, so its answer is already
  // on disk — and it is right for this repo and for any fork without either having
  // to be spelled out. Slugifying instead would have broken THIS repo, whose
  // Pages path really is capitalised; the E2E sitemap spec caught exactly that.
  const name =
    env.NEXT_PUBLIC_PROJECT_NAME || detectedProjectName() || 'ScriptHammer';
  const basePath = env.NEXT_PUBLIC_BASE_PATH;

  return {
    url: `https://${owner}.github.io${basePath || `/${name}`}`.replace(
      /\/+$/,
      ''
    ),
    source: basePath
      ? 'GitHub Pages + NEXT_PUBLIC_BASE_PATH (no NEXT_PUBLIC_DEPLOY_URL set)'
      : 'GitHub Pages default (no NEXT_PUBLIC_DEPLOY_URL set)',
  };
}

function assertValidSiteUrl(siteUrl) {
  try {
    new URL(siteUrl);
  } catch {
    throw new Error(`Resolved site URL is not a valid URL: ${siteUrl}`);
  }
}

module.exports = { resolveSiteUrl, assertValidSiteUrl };
