/**
 * `public/robots.txt` is generated during prebuild but deliberately tracked.
 * Keep the checked-in copy and a fresh generator run pinned to the configured
 * production origin, so a build without NEXT_PUBLIC_DEPLOY_URL cannot quietly
 * put the GitHub Pages fallback back into a reviewable diff (#504).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate-sitemap.js');
const ROBOTS_PATH = path.join(ROOT, 'public', 'robots.txt');
const AUTH_CONFIG_PATH = path.join(
  ROOT,
  'scripts',
  'supabase',
  'auth-config.json'
);
const { loadAuthConfig } = require(
  path.join(ROOT, 'scripts', 'supabase', 'auth-config-loader.js')
);

function normalizeOrigin(origin) {
  return origin.trim().replace(/\/+$/, '');
}

function configuredCanonicalOrigin() {
  // Through the shared loader (#734): `site_url` is now `${AUTH_SITE_URL:-…}`, so a
  // raw JSON.parse would hand `new URL()` a literal `${…}` string and fail on a
  // correct repo. Ambient env is passed deliberately here — a fork that sets
  // AUTH_SITE_URL should have its canonical artifacts checked against ITS origin.
  const authConfig = loadAuthConfig(AUTH_CONFIG_PATH, process.env);
  // CI supplies the deployed value. A clean checkout has no .env, so use the
  // versioned non-secret production site URL as the deterministic fallback.
  const origin = process.env.NEXT_PUBLIC_DEPLOY_URL || authConfig.site_url;

  assert.ok(origin, 'expected a deployment or Supabase site URL');
  assert.doesNotThrow(() => new URL(origin));

  return normalizeOrigin(origin);
}

function sitemapUrlFromRobots(robotsTxt) {
  const sitemapLine = robotsTxt
    .split(/\r?\n/)
    .find((line) => line.startsWith('Sitemap: '));

  assert.ok(sitemapLine, 'robots.txt must declare a Sitemap URL');
  return sitemapLine.slice('Sitemap: '.length);
}

function sitemapLocs(sitemapXml) {
  return Array.from(
    sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g),
    (match) => match[1]
  );
}

function assertCanonicalArtifacts({ robotsTxt, sitemapXml, origin }) {
  assert.strictEqual(
    sitemapUrlFromRobots(robotsTxt),
    `${origin}/sitemap.xml`,
    'robots.txt must advertise the configured canonical sitemap URL'
  );

  const locs = sitemapLocs(sitemapXml);
  assert.ok(locs.length > 0, 'generated sitemap must contain at least one URL');
  assert.ok(
    locs.every((loc) => loc.startsWith(`${origin}/`)),
    `every sitemap URL must use the configured canonical origin (${origin})`
  );
}

function makeGeneratorFixture() {
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), 'scripthammer-canonical-artifacts-')
  );
  fs.mkdirSync(path.join(fixture, 'public'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'src', 'lib', 'blog'), { recursive: true });
  fs.writeFileSync(
    path.join(fixture, 'src', 'lib', 'blog', 'blog-data.json'),
    JSON.stringify({ posts: [] })
  );
  return fixture;
}

function generateArtifacts({ cwd, origin }) {
  const result = spawnSync(process.execPath, [GENERATOR_PATH], {
    cwd,
    encoding: 'utf8',
    env: {
      NEXT_PUBLIC_DEPLOY_URL: origin,
      NEXT_PUBLIC_PROJECT_OWNER: 'ExampleOwner',
      NEXT_PUBLIC_PROJECT_NAME: 'ExampleProject',
      NEXT_PUBLIC_BASE_PATH: '',
    },
  });

  assert.strictEqual(
    result.status,
    0,
    `sitemap generator failed:\n${result.stderr || result.stdout}`
  );

  return {
    robotsTxt: fs.readFileSync(path.join(cwd, 'public', 'robots.txt'), 'utf8'),
    sitemapXml: fs.readFileSync(
      path.join(cwd, 'public', 'sitemap.xml'),
      'utf8'
    ),
  };
}

test('the tracked robots file advertises the configured canonical sitemap', () => {
  const origin = configuredCanonicalOrigin();
  const robotsTxt = fs.readFileSync(ROBOTS_PATH, 'utf8');

  assert.strictEqual(
    sitemapUrlFromRobots(robotsTxt),
    `${origin}/sitemap.xml`,
    'a local fallback build must not be committed as the production robots file'
  );
});

test('the sitemap generator gives robots and sitemap the configured canonical origin', () => {
  const origin = configuredCanonicalOrigin();
  const fixture = makeGeneratorFixture();

  try {
    const artifacts = generateArtifacts({ cwd: fixture, origin });
    assertCanonicalArtifacts({ ...artifacts, origin });

    // Deliberate negative control: the assertion must reject the exact drift
    // #504 guards against, rather than merely observing a happy-path artifact.
    const staleSitemapUrl =
      origin === 'https://tortoisewolfe.github.io/ScriptHammer'
        ? 'https://wrong-origin.example/sitemap.xml'
        : 'https://tortoisewolfe.github.io/ScriptHammer/sitemap.xml';
    const fallbackRobots = artifacts.robotsTxt.replace(
      `${origin}/sitemap.xml`,
      staleSitemapUrl
    );
    assert.throws(
      () =>
        assertCanonicalArtifacts({
          ...artifacts,
          robotsTxt: fallbackRobots,
          origin,
        }),
      /robots\.txt must advertise the configured canonical sitemap URL/
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
