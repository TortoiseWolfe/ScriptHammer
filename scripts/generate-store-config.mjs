#!/usr/bin/env node
/**
 * Generate `store.config.json`, the file `eas metadata:push` reads (#1086).
 *
 * WHAT THIS IS FOR. The App Store version page ("1.0 Prepare for Submission") is a wall of
 * fields, and unlike the app record itself, that half IS writable through Apple's API.
 * `eas-cli` already implements the push; this only produces its input.
 *
 * WHAT IT WILL NOT DO: invent marketing copy. `description`, `keywords`, `promoText`,
 * `categories` and the age rating are left as explicit TODO markers, because a generator
 * cannot know what a product is and a plausible-sounding guess is worse than a blank — it
 * reads as finished and ships as a public claim about someone's software.
 *
 * THE SEQUENCING RULE, recorded because it is easy to get backwards. Metadata is a set of
 * public claims about a product. Writing them before the product exists is how a sibling
 * project came to publish a data-retention promise its system did not honour. Generate this
 * whenever you like; PUSH it only once there is a build to describe.
 *
 * NEVER COMMIT THE RESULT. `review.demoPassword` is a real credential for a real account,
 * and this file is listed in `.gitignore` for that reason. The generator only ever writes the
 * NAME of the environment variable, never its value, so a generated file is safe until a
 * human pastes a password into it — which is exactly when the ignore rule earns its keep.
 *
 * USAGE
 *   node scripts/generate-store-config.mjs [--name "App Name"] [--out store.config.json]
 *
 * `--name` is the claimed App Store listing name. `scripts/claim-app-store.mjs --json`
 * prints it as `storeName`, so the two compose:
 *   node scripts/claim-app-store.mjs --json | jq -r .storeName | xargs -0 ...
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The marker every un-derivable field carries, so one grep finds all of them. */
export const TODO = 'TODO: fill in before pushing';

/**
 * The site's custom domain, or null.
 *
 * Reads what the BUILD decided (`src/config/project-detected.json`, written by prebuild)
 * before falling back to the tracked config, for the same reason `check-custom-domain.mjs`
 * does: a fork mid-migration has a correct legacy value and a stale config, and re-deriving
 * would disagree with the build in exactly that case.
 */
export function siteDomain(root = ROOT) {
  for (const rel of [
    ['src', 'config', 'project-detected.json'],
    ['config', 'deployment.json'],
  ]) {
    const file = path.join(root, ...rel);
    if (!existsSync(file)) continue;
    try {
      const json = JSON.parse(readFileSync(file, 'utf8'));
      if (json.customDomain) return String(json.customDomain);
    } catch {
      // A malformed file is not a reason to invent a domain — try the next source.
    }
  }
  return null;
}

/** The owner name for the copyright line, or null when nothing knows it. */
export function siteOwner(root = ROOT) {
  const detected = path.join(root, 'src', 'config', 'project-detected.json');
  if (existsSync(detected)) {
    try {
      const json = JSON.parse(readFileSync(detected, 'utf8'));
      if (json.projectOwner) return String(json.projectOwner);
    } catch {
      /* fall through */
    }
  }
  return process.env.NEXT_PUBLIC_PROJECT_OWNER || null;
}

/**
 * Build the config object.
 *
 * Split from the writer so tests can assert the SHAPE without touching disk, and so the
 * TODO markers are checkable rather than eyeballed.
 */
export function buildStoreConfig({ domain, owner, name, year } = {}) {
  // A domain gives three of the four URL fields for free. Without one they are TODO, not
  // guessed — a wrong support URL is worse than an obviously missing one, because Apple
  // will happily accept it and a real user will hit a 404 asking for help.
  const base = domain ? `https://${domain}` : null;

  return {
    configVersion: 0,
    apple: {
      info: {
        'en-US': {
          title: name || TODO,
          subtitle: TODO,
          description: TODO,
          keywords: [TODO],
          promoText: TODO,
          privacyPolicyUrl: base ? `${base}/privacy/` : TODO,
          supportUrl: base ? `${base}/contact/` : TODO,
          marketingUrl: base ? `${base}/` : TODO,
        },
      },
      categories: [TODO],
      advisory: TODO,
      copyright: owner ? `${year} ${owner}` : TODO,
      review: {
        firstName: TODO,
        lastName: TODO,
        phone: TODO,
        email: TODO,
        demoUsername: TODO,
        // The NAME of the variable, never its value. See the header.
        demoPassword: '$APPSTORE_DEMO_PASSWORD',
        notes: TODO,
      },
      // `manual` so a push never releases by itself. Changing this to `automatic` means the
      // next successful review goes live with no human in the loop.
      release: { automaticRelease: false },
    },
  };
}

/** Every dotted path still carrying a TODO marker, for the summary and for tests. */
export function pendingFields(config, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(config)) {
    const at = prefix ? `${prefix}.${k}` : k;
    if (v === TODO) out.push(at);
    else if (Array.isArray(v)) {
      if (v.includes(TODO)) out.push(at);
    } else if (v && typeof v === 'object') out.push(...pendingFields(v, at));
  }
  return out;
}

export function main(argv = process.argv.slice(2)) {
  const arg = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const out = path.resolve(ROOT, arg('--out') ?? 'store.config.json');
  const domain = siteDomain();
  const owner = siteOwner();
  const name = arg('--name');
  const year = new Date().getUTCFullYear();

  const config = buildStoreConfig({ domain, owner, name, year });
  writeFileSync(out, JSON.stringify(config, null, 2) + '\n');

  const pending = pendingFields(config);
  console.log(`  wrote ${path.relative(ROOT, out)}`);
  console.log(`  domain ... ${domain ?? '(none configured — URLs are TODO)'}`);
  console.log(`  owner .... ${owner ?? '(unknown — copyright is TODO)'}`);
  console.log(`  listing .. ${name ?? '(no --name given — title is TODO)'}`);
  console.log(`\n  ${pending.length} field(s) still need a human:`);
  for (const p of pending) console.log(`    ${p}`);
  console.log(
    `\n  This file is gitignored on purpose: review.demoPassword is a real credential.\n` +
      `  Do not push metadata before there is a build to describe (#1086).`
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
