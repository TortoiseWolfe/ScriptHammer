/**
 * Does the thing we are about to publish agree with itself about its own address? (#980)
 *
 * NOTHING HAS EVER AUDITED THE UPLOADED DIRECTORY. deploy.yml's three build gates —
 * check-chunks-parse, check-first-load-budget, check-canonicals — all read `out/`, and all
 * three run BEFORE the merge step that assembles `merged-output`. `merged-output` is what
 * `actions/upload-pages-artifact` actually receives. Everything between the merge and the
 * upload has been unexamined.
 *
 * WHAT CAN GO WRONG, and why one assertion is not enough. The custom domain and the base
 * path are two halves of one fact:
 *
 *   CNAME present  =>  served at an apex   =>  assets must be UNPREFIXED
 *   CNAME absent   =>  served at /<repo>/  =>  assets must be PREFIXED
 *
 * Get them out of step and the deploy is green while the site is dead: every asset 404s and
 * nothing reports it. That is #961's failure, and the reason #980 wants the two derived
 * from one configuration rather than from a filesystem check.
 *
 * THE PRECISION TRAP, stated because it defeated the first draft of this file:
 * `/ScriptHammer/_next/static/x.js` CONTAINS the substring `/_next/`. Any assertion built on
 * `includes('/_next/')` therefore passes on exactly the artifact it exists to reject. Every
 * path comparison here is ANCHORED with startsWith, never a substring search.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

/**
 * THE CONFIGURED DOMAIN, or null for none.
 *
 * Today that configuration IS the tracked `public/CNAME`, whose mere existence decides the
 * base path. This is the single place that knowledge lives, so when #980 moves the source of
 * truth to a config key, this function is the only thing that changes.
 */
export function configuredDomain(root = ROOT) {
  const file = path.join(root, 'public', 'CNAME');
  if (!existsSync(file)) return null;
  const value = readFileSync(file, 'utf8').trim();
  return value || null;
}

/** The repository name, which is the base-path segment a project site is served under. */
export function projectName(root = ROOT) {
  try {
    const detected = JSON.parse(
      readFileSync(
        path.join(root, 'src', 'config', 'project-detected.json'),
        'utf8'
      )
    );
    if (detected.projectName) return detected.projectName;
  } catch {
    /* generated file; absent on a clean checkout */
  }
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  return remote
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .pop();
}

/**
 * Every SAME-ORIGIN absolute reference in the document.
 *
 * Deliberately not every href: `//cdn…` and `https://…` are other origins and say nothing
 * about our base path, and `./x` or `x` are relative and correct either way.
 */
export function absoluteRefs(html) {
  return [...html.matchAll(/(?:href|src)="(\/[^"/][^"]*)"/g)].map((m) => m[1]);
}

/**
 * @returns {{problems: string[], summary: string}} problems is empty when the artifact is
 * coherent. summary states WHAT WAS VERIFIED — a success line that merely says "ok" invites
 * the reader to assume the strict rule ran when an override may have relaxed it.
 */
export function checkCustomDomain({
  domain,
  cnameBytes,
  html,
  name,
  deployUrl,
  envBasePath = '',
  basePathDisabled = false,
}) {
  const problems = [];

  // A. The configuration and the artifact agree about whether there is a domain at all.
  if (domain === null && cnameBytes !== null) {
    problems.push(
      `no custom domain is configured, but the artifact ships a CNAME (${JSON.stringify(cnameBytes)}). Its presence drops the base path, so every asset will 404.`
    );
  }
  if (domain !== null && cnameBytes === null) {
    problems.push(
      `${domain} is configured, but the artifact has no CNAME at its root. GitHub Pages would serve this at the project URL.`
    );
  }
  if (domain !== null && cnameBytes !== null && cnameBytes !== domain) {
    problems.push(
      `the artifact's CNAME is ${JSON.stringify(cnameBytes)} but ${JSON.stringify(domain)} is configured. A CNAME naming a domain you do not control 404s every asset.`
    );
  }

  // B. The artifact's own asset paths agree with that decision.
  const refs = absoluteRefs(html);
  const assets = refs.filter((r) => r.includes('/_next/'));

  // ANTI-VACUITY. With no asset references at all, every clause below is trivially true
  // and this gate would approve an empty page. Note the floor asks only "did we find any
  // build output to reason about", which is the one place a substring is the right test.
  if (assets.length === 0) {
    problems.push(
      'no /_next/ asset references found in the artifact index.html — nothing to check, which means this gate proved nothing.'
    );
    return { problems, summary: 'no asset references found' };
  }

  // THE EXPECTED PREFIX MIRRORS detect-project.js's OWN PRECEDENCE, and must:
  //   DISABLE_BASE_PATH=true  >  NEXT_PUBLIC_BASE_PATH  >  derived from the domain
  //
  // Re-deriving it strictly from the domain instead would red-flag every build that sets
  // the override deliberately — the `basepath` E2E project, DISABLE_BASE_PATH runs, and any
  // local build whose .env pins a prefix. Measured, not hypothetical: this repo's own .env
  // pins /ScriptHammer, so the strict version failed on a perfectly correct local artifact.
  //
  // In the deploy neither is set — deploy.yml omits NEXT_PUBLIC_BASE_PATH on purpose so
  // detection can run — which is exactly where the derived rule below does the gating.
  const expectedPrefix = basePathDisabled
    ? ''
    : envBasePath
      ? `${envBasePath.replace(/\/$/, '')}/`
      : domain !== null
        ? ''
        : `/${name}/`;
  const source = basePathDisabled
    ? 'DISABLE_BASE_PATH=true'
    : envBasePath
      ? `NEXT_PUBLIC_BASE_PATH=${envBasePath}`
      : domain !== null
        ? `the custom domain ${domain}`
        : 'no custom domain, so the project-site path';

  const wrong = expectedPrefix
    ? assets.filter((r) => !r.startsWith(expectedPrefix))
    : assets.filter((r) => r.startsWith(`/${name}/`));

  if (wrong.length > 0) {
    problems.push(
      expectedPrefix
        ? `${source} means assets must start with ${expectedPrefix}, but ${wrong.length} do not, e.g. ${wrong[0]}`
        : `${source} means assets must be unprefixed, but ${wrong.length} start with /${name}/, e.g. ${wrong[0]}`
    );
  }

  // C. The deploy origin agrees too. This is the only clause comparing the tree against a
  //    fact configured OUTSIDE it, which is what makes the set non-circular: A and B both
  //    compare the artifact to the config, so a wrong config satisfies them faithfully.
  if (deployUrl) {
    let host;
    try {
      host = new URL(deployUrl).host;
    } catch {
      problems.push(`DEPLOY_URL is not a URL: ${JSON.stringify(deployUrl)}`);
      return { problems, summary: 'DEPLOY_URL unparseable' };
    }
    const isPages = host.endsWith('.github.io');
    if (isPages && domain !== null) {
      problems.push(
        `the deploy origin is ${host} (a project site) but ${domain} is configured as a custom domain. One of the two is wrong.`
      );
    }
    if (!isPages && domain === null) {
      problems.push(
        `the deploy origin is ${host} but no custom domain is configured, so the artifact carries no CNAME and Pages will not serve that host.`
      );
    }
    if (!isPages && domain !== null) {
      const bare = (h) => h.replace(/^www\./, '');
      if (bare(host) !== bare(domain)) {
        problems.push(
          `the deploy origin is ${host} but the configured domain is ${domain}. They must be the same host (a leading www. may differ).`
        );
      }
    }
  }

  return {
    problems,
    summary: `${assets.length} asset ref(s); ${domain ? `domain ${domain}` : 'no custom domain'}; base path from ${source}${expectedPrefix ? ` (expects ${expectedPrefix})` : ' (expects no prefix)'}${deployUrl ? `; origin ${deployUrl}` : '; origin unchecked (DEPLOY_URL unset)'}`,
  };
}

// --- CLI ---------------------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || 'out';
  const indexPath = path.join(root, 'index.html');
  if (!existsSync(indexPath)) {
    console.error(
      `::error::${indexPath} does not exist — nothing was built to check.`
    );
    process.exit(1);
  }
  const cnamePath = path.join(root, 'CNAME');
  const { problems, summary } = checkCustomDomain({
    domain: configuredDomain(),
    cnameBytes: existsSync(cnamePath)
      ? readFileSync(cnamePath, 'utf8').trim()
      : null,
    html: readFileSync(indexPath, 'utf8'),
    name: projectName(),
    deployUrl: (process.env.DEPLOY_URL || '').trim(),
    envBasePath: (process.env.NEXT_PUBLIC_BASE_PATH || '').trim(),
    basePathDisabled: process.env.DISABLE_BASE_PATH === 'true',
  });

  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log(`✅ ${root}: ${summary}`);
}
