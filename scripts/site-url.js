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
  const name = env.NEXT_PUBLIC_PROJECT_NAME || 'ScriptHammer';
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
