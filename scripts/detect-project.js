#!/usr/bin/env node

/**
 * Auto-detects project information from git remote URL
 * Generates project configuration for build-time use
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitRemoteUrl() {
  try {
    const url = execSync('git remote get-url origin', {
      encoding: 'utf8',
    }).trim();
    return url;
  } catch (error) {
    console.warn('Warning: Not a git repository or no remote origin set');
    return null;
  }
}

function parseGitUrl(url) {
  if (!url) return null;

  // Handle different Git URL formats
  const patterns = [
    // HTTPS: https://github.com/username/repo.git
    /https?:\/\/github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/,
    // SSH: git@github.com:username/repo.git
    /git@github\.com:([^\/]+)\/([^\/\.]+)(\.git)?$/,
    // GitHub CLI: gh:username/repo
    /gh:([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        isGitHub: true,
      };
    }
  }

  // Try generic git URL parsing for other hosts.
  // ^ anchor + @ in the host exclusion class are both load-bearing: without
  // them, `git@@github.com:user/repo` matches and captures `@github.com` as
  // the host — garbage that silently propagates into basePath/projectUrl.
  const genericPattern =
    /^(?:git@|https?:\/\/)([^:\/@]+)[:\/]([^\/]+)\/([^\/\.]+)(?:\.git)?$/;
  const genericMatch = url.match(genericPattern);
  if (genericMatch) {
    return {
      host: genericMatch[1],
      owner: genericMatch[2],
      repo: genericMatch[3],
      isGitHub: genericMatch[1].includes('github'),
    };
  }

  return null;
}

function getProjectInfo() {
  // Check for environment variable overrides first
  if (
    process.env.NEXT_PUBLIC_PROJECT_NAME &&
    process.env.NEXT_PUBLIC_PROJECT_OWNER
  ) {
    return {
      projectName: process.env.NEXT_PUBLIC_PROJECT_NAME,
      projectOwner: process.env.NEXT_PUBLIC_PROJECT_OWNER,
      isGitHub: true,
      source: 'env',
    };
  }

  // Try to detect from git
  const gitUrl = getGitRemoteUrl();
  const gitInfo = parseGitUrl(gitUrl);

  if (gitInfo) {
    return {
      projectName: gitInfo.repo,
      projectOwner: gitInfo.owner,
      projectHost: gitInfo.host || 'github.com',
      isGitHub: gitInfo.isGitHub,
      source: 'git',
      gitUrl: gitUrl,
    };
  }

  // Fallback to defaults
  return {
    projectName: 'ScriptHammer',
    projectOwner: 'TortoiseWolfe',
    projectHost: 'github.com',
    isGitHub: true,
    source: 'default',
  };
}

const DEPLOYMENT_CONFIG = path.join(
  __dirname,
  '..',
  'config',
  'deployment.json'
);
const CNAME_FILE = path.join(__dirname, '..', 'public', 'CNAME');

/** Is a path tracked in git? Used to tell a fork's committed file from one we generated. */
function isTracked(file) {
  try {
    execSync(`git ls-files --error-unmatch ${JSON.stringify(file)}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * The configured custom domain, or null for none.
 *
 * THE LEGACY CLAUSE IS NOT DEFENSIVE CLUTTER — it protects a live client site. Forks were
 * told by docs/FORKING.md to put their own domain in public/CNAME and commit it, and at
 * least one live site did. When such a fork takes this change from upstream, git raises a
 * modify/delete conflict (verified, not assumed) so the file is not silently lost — but the
 * NEW config arrives from upstream declaring THIS project's domain. Trusting it blindly
 * would rewrite their CNAME to ours on their next deploy.
 *
 * So a TRACKED public/CNAME outranks the config, loudly. Tracked is the precise
 * discriminator: a file we generate is gitignored, while one a fork committed is not. The
 * clause therefore disables itself the moment that fork migrates, with no flag to remember
 * and no deprecation date to enforce.
 */
function resolveCustomDomain() {
  let configured;
  let hasConfig = false;
  try {
    const parsed = JSON.parse(fs.readFileSync(DEPLOYMENT_CONFIG, 'utf8'));
    hasConfig = true;
    configured =
      typeof parsed.customDomain === 'string' && parsed.customDomain.trim()
        ? parsed.customDomain.trim()
        : null;
  } catch {
    configured = null;
  }

  const legacy = fs.existsSync(CNAME_FILE)
    ? fs.readFileSync(CNAME_FILE, 'utf8').trim() || null
    : null;

  if (legacy && isTracked(CNAME_FILE)) {
    if (!hasConfig || configured !== legacy) {
      console.warn(
        `⚠  public/CNAME is tracked in git and says "${legacy}".\n` +
          `   The custom domain is configuration now (#980). Using the file, not the config.\n` +
          `   To migrate: put it in config/deployment.json as { "customDomain": "${legacy}" },\n` +
          `   then run: git rm --cached public/CNAME`
      );
    }
    return { domain: legacy, source: 'legacy-cname' };
  }

  return { domain: configured, source: hasConfig ? 'config' : 'none' };
}

/**
 * GitHub Pages needs a CNAME in the PUBLISHED artifact, so the file still ships — it is
 * simply generated rather than committed, like the manifest, robots.txt, the sitemap and
 * the feeds. `output: 'export'` copies public/ wholesale, and this script is prebuild step
 * one AND is re-run by next.config.ts, so the file is always in place before the copy.
 *
 * Byte-identical to what was committed before: no trailing newline. The bytes are never
 * derived from NEXT_PUBLIC_DEPLOY_URL — this project's CNAME names the www host while its
 * canonical origin is the apex, and site-url.js:8-13 documents why the two are not
 * interchangeable. Changing the mechanism and the value together would make any failure
 * undiagnosable.
 */
function syncCnameFile(domain) {
  if (domain) {
    const current = fs.existsSync(CNAME_FILE)
      ? fs.readFileSync(CNAME_FILE, 'utf8')
      : null;
    if (current !== domain) {
      fs.mkdirSync(path.dirname(CNAME_FILE), { recursive: true });
      fs.writeFileSync(CNAME_FILE, domain);
    }
    return;
  }
  // No domain configured: there must be no CNAME, because its EXISTENCE is what drops the
  // base path. Never delete one a fork committed — that is the legacy case above, which
  // never reaches here since it resolves to a domain.
  if (fs.existsSync(CNAME_FILE) && !isTracked(CNAME_FILE)) {
    fs.unlinkSync(CNAME_FILE);
  }
}

function generateConfig() {
  const info = getProjectInfo();

  // Determine if we're in GitHub Actions CI/CD
  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

  // Explicit opt-out for jobs that serve the static export from the ROOT
  // (e.g. the E2E workflow's `serve out -l 3000`). Without this, the build
  // bakes in the GitHub Pages basePath (/RepoName) and every
  // /RepoName/_next/*.js asset 404s when served at /, so React never hydrates
  // and the whole E2E suite fails. A step-level `GITHUB_ACTIONS: false` is NOT
  // reliable — the runner re-injects GITHUB_ACTIONS=true into the child
  // processes spawned by `pnpm build` / next.config's execSync — so we need an
  // unambiguous, dedicated signal that survives that.
  const basePathDisabled = process.env.DISABLE_BASE_PATH === 'true';

  // THE CUSTOM DOMAIN IS CONFIGURATION NOW, NOT A FILE'S EXISTENCE (#980).
  //
  // This used to be `fs.existsSync(public/CNAME)` — the only piece of deploy config in the
  // project whose mere presence changed the build, and whose contents were never read. You
  // could not comment it, could not empty it (the CNAME format has no comment syntax and
  // an empty file still exists), and deleting was the only way to flip the boolean. That is
  // why #961 had to delete rather than blank it, and why --keep-cname existed at all.
  const { domain: customDomain, source: domainSource } = resolveCustomDomain();

  // Base path: explicit disable wins; then explicit env var; then
  // auto-detection for the GitHub Pages deploy build.
  const basePath = basePathDisabled
    ? ''
    : process.env.NEXT_PUBLIC_BASE_PATH ||
      (isGitHubActions && info.isGitHub && !customDomain
        ? `/${info.projectName}`
        : '');

  const config = {
    projectName: info.projectName,
    projectOwner: info.projectOwner,
    projectHost: info.projectHost || 'github.com',
    projectUrl: info.isGitHub
      ? `https://github.com/${info.projectOwner}/${info.projectName}`
      : info.gitUrl || '',
    basePath: basePath,
    customDomain: customDomain,
    isGitHub: info.isGitHub,
    detectionSource: info.source,
    generatedAt: new Date().toISOString(),
  };

  // AFTER basePath is decided and BEFORE anything copies public/. The two are one fact:
  // a CNAME means an apex and no prefix; no CNAME means /<repo>/ and a prefix. Deriving
  // both here is what stops them drifting apart, which is #961's failure.
  syncCnameFile(customDomain);

  // Write to multiple formats for flexibility
  const configDir = path.join(__dirname, '..', 'src', 'config');

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Write JSON version
  const jsonPath = path.join(configDir, 'project-detected.json');
  fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2));

  // Write TypeScript module
  const tsContent = `// Auto-generated by detect-project.js
// DO NOT EDIT MANUALLY - This file is regenerated on each build

export const detectedConfig = ${JSON.stringify(config, null, 2)} as const;

export type DetectedConfig = typeof detectedConfig;
`;

  const tsPath = path.join(configDir, 'project-detected.ts');
  fs.writeFileSync(tsPath, tsContent);

  // Write .env.local if it doesn't exist
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    const envContent = `# Auto-generated project configuration
NEXT_PUBLIC_PROJECT_NAME=${config.projectName}
NEXT_PUBLIC_PROJECT_OWNER=${config.projectOwner}
NEXT_PUBLIC_BASE_PATH=${config.basePath}
`;
    fs.writeFileSync(envPath, envContent);
  }

  console.log('✅ Project configuration detected:');
  console.log(`   Name: ${config.projectName}`);
  console.log(`   Owner: ${config.projectOwner}`);
  console.log(`   Base Path: ${config.basePath || '/'}`);
  console.log(`   Custom Domain: ${customDomain || 'none'} (${domainSource})`);
  console.log(`   Source: ${config.detectionSource}`);

  return config;
}

// Run if called directly
if (require.main === module) {
  generateConfig();
}

module.exports = { generateConfig, getProjectInfo, parseGitUrl };
