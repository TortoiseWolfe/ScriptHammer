#!/usr/bin/env node
// Claim an App Store name and identifier, and wire the result into the repo.
//
// WHY THIS EXISTS
// `rebrand.sh` takes a fork from ScriptHammer to a named project in 71 seconds,
// and then stops at the one external service that most reliably defeats a new
// iOS developer. Setting an app up in App Store Connect is roughly twenty fields
// across two websites, four of which are permanent, one of which (the export
// compliance flag) silently swallows every TestFlight build if you miss it, and
// none of which is written down in one place. Doing it by hand for RunIt took
// hours and still shipped a permission string for a capability the app did not
// have.
//
// This automates everything Apple permits and refuses to pretend about the rest.
//
// THE ONE THING THIS CANNOT DO
// `POST /v1/apps` is FORBIDDEN on the App Store Connect API — the `apps` resource
// allows only GET_COLLECTION, GET_INSTANCE and UPDATE. Creating the app record is
// a browser dialog, deliberately, because Apple wants a person to own that act and
// to have accepted the current agreements. `eas submit` cannot do it either; its
// docs tell you to read the id off a record that already exists.
//
// So this tool does everything on both sides of that dialog, pre-computes every
// field in it, waits, and verifies what you did. See --help.
//
// USAGE
//   node scripts/claim-app-store.mjs <STORE_NAME> --bundle-id <id> [OPTIONS]
//
//   ASC_ISSUER_ID=<uuid> ASC_KEY_ID=<keyid> \
//     node scripts/claim-app-store.mjs "geoLARP" --bundle-id com.geolarp.app
//
// EXIT CODES
//   0  Done — the record exists, the name is set, and the repo is wired up.
//   1  Validation or API failure.
//   2  Declined at a confirmation.
//   3  Credentials or environment error (no key, no issuer id, key inside the repo).
//   4  WAITING ON A HUMAN — the bundle id is registered and the dialog is printed,
//      but the app record does not exist yet. Not a failure. Re-run to resume.
//
// WHY 4 IS ITS OWN CODE
// "The identifier is registered, the files are written, and now a person must open
// a browser" is neither success nor failure, and CI has to be able to tell the
// difference. A run that exits 4 has done real work and is resumable.

import { createSign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

// Overridable ONLY so the tool can be tested without touching Apple, the same
// seam `check-email-health.mjs` uses for the same reason: without it, the only
// way to exercise the failure paths is to have a real failure.
const API = process.env.ASC_API_BASE || 'https://api.appstoreconnect.apple.com';

const EXIT = { OK: 0, FAIL: 1, DECLINED: 2, CREDENTIALS: 3, WAITING: 4 };

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 &&
    process.argv[i + 1] &&
    !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const JSON_OUT = has('json');
const DRY = has('dry-run');
const report = { steps: [], warnings: [] };

function say(sym, msg) {
  report.steps.push({ sym, msg });
  if (!JSON_OUT) console.log(`  ${sym} ${msg}`);
}
function warn(msg) {
  report.warnings.push(msg);
  if (!JSON_OUT) console.log(`  ! ${msg}`);
}
function die(code, msg, hint) {
  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        { ok: false, exit: code, error: msg, hint, ...report },
        null,
        2
      )
    );
  } else {
    console.error(`\n  ✗ ${msg}`);
    if (hint) console.error(`\n${hint}`);
  }
  process.exit(code);
}

function showHelp() {
  // Print the header block, the same trick rebrand.sh uses so usage text and the
  // file cannot drift apart.
  const src = readFileSync(new URL(import.meta.url), 'utf-8');
  const out = [];
  // The LEADING comment block only. Taking every `//` line in the file would
  // also print the internal section dividers, which is what it did first.
  for (const line of src.split('\n').slice(1)) {
    if (!line.startsWith('//')) break;
    out.push(line.replace(/^\/\/ ?/, ''));
  }
  console.log(out.join('\n'));
}

// ---------------------------------------------------------------------------
// Credentials. The key never enters this file's output, and never should enter
// the repo — `~/.appstoreconnect/private_keys/` is Apple's own search path and
// is outside every git tree, which is a stronger property than gitignoring it:
// gitleaks cannot leak what was never in the working copy.
// ---------------------------------------------------------------------------
function resolveKey() {
  const issuerId = process.env.ASC_ISSUER_ID;
  if (!issuerId) {
    die(
      EXIT.CREDENTIALS,
      'ASC_ISSUER_ID is not set.',
      [
        '  The Issuer ID is a UUID shown above the Team Keys table at',
        '    https://appstoreconnect.apple.com/access/integrations/api',
        '',
        '  It is NOT a secret — it identifies the team, not you — but it is also',
        '  NOT recoverable from the .p8 file. Losing it means generating a new key,',
        '  so put it in a password manager, then:',
        '',
        '    export ASC_ISSUER_ID=<uuid>',
      ].join('\n')
    );
  }

  let keyPath = process.env.ASC_KEY_PATH;
  const keyDir = join(homedir(), '.appstoreconnect', 'private_keys');
  let keyId = process.env.ASC_KEY_ID;

  if (!keyPath) {
    if (keyId) {
      keyPath = join(keyDir, `AuthKey_${keyId}.p8`);
    } else if (existsSync(keyDir)) {
      const found = readdirSync(keyDir).filter((f) =>
        /^AuthKey_.+\.p8$/.test(f)
      );
      // Refuse to pick. Two keys and an arbitrary choice is how a bundle id gets
      // registered under the wrong team, which is unrecoverable.
      if (found.length > 1) {
        die(
          EXIT.CREDENTIALS,
          `${found.length} keys in ${keyDir} — refusing to guess.`,
          '  Set ASC_KEY_ID=<keyid> to choose one.'
        );
      }
      if (found.length === 1) keyPath = join(keyDir, found[0]);
    }
  }
  if (!keyPath || !existsSync(keyPath)) {
    die(
      EXIT.CREDENTIALS,
      'No App Store Connect API key found.',
      [
        `  Looked in ${keyDir}`,
        '',
        '  Create one at App Store Connect → Users and Access → Integrations →',
        '  Team Keys → +. Give it the App Manager role (Developer cannot write',
        '  metadata). The .p8 downloads exactly ONCE. Save it as',
        `    ${keyDir}/AuthKey_<KEYID>.p8`,
      ].join('\n')
    );
  }
  keyId = keyId || keyPath.match(/AuthKey_(.+)\.p8$/)?.[1];
  if (!keyId) die(EXIT.CREDENTIALS, `Cannot derive a key id from ${keyPath}.`);

  // A key inside the working tree is already a leak in waiting. Say so loudly
  // rather than quietly succeeding and letting it get committed next week.
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (resolve(keyPath).startsWith(resolve(top) + '/')) {
      die(
        EXIT.CREDENTIALS,
        'That key is inside the repository.',
        '  Rotate it at appstoreconnect.apple.com/access/integrations/api before\n  doing anything else, then store the replacement outside any git tree.'
      );
    }
  } catch {
    /* not a git repo — nothing to protect */
  }

  return { issuerId, keyId, keyP8: readFileSync(keyPath, 'utf-8'), keyPath };
}

const b64url = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

function makeJWT({ issuerId, keyId, keyP8 }) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  // Apple's ceiling is 20 minutes; anything longer is rejected outright.
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 1200,
    aud: 'appstoreconnect-v1',
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  // ieee-p1363 is the raw 64-byte form JOSE wants. The default DER encoding
  // produces a signature Apple rejects with an opaque 401.
  const sig = signer.sign({ key: keyP8, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(sig)}`;
}

async function asc(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* Apple occasionally returns HTML on a gateway error */
  }
  if (!res.ok) {
    // Print Apple's own sentence. Its wording distinguishes "already in use"
    // from "too long" from "contains a reserved term", and those need different
    // fixes — paraphrasing them costs the reader the actual answer.
    const detail =
      json?.errors
        ?.map((e) => `${e.title}: ${e.detail || ''}`.trim())
        .join('\n      ') || text.slice(0, 300);
    const err = new Error(`${method} ${path} → ${res.status}\n      ${detail}`);
    err.status = res.status;
    err.apple = json?.errors ?? [];
    throw err;
  }
  return json;
}

// ---------------------------------------------------------------------------
// Validation. Both of these are permanent once used, so they are checked before
// anything is written rather than discovered by Gradle or by App Review.
// ---------------------------------------------------------------------------
function validateBundleId(id) {
  const segs = id.split('.');
  if (segs.length < 2) return 'must have at least two dot-separated segments';
  for (const s of segs) {
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(s)) {
      // A hyphenated project name yields a package Android cannot build, and
      // nothing tells you until Gradle. Leading digits fail the same way.
      return `segment "${s}" must start with a letter and contain only letters, digits and hyphens`;
    }
  }
  return null;
}

function validateStoreName(name) {
  if (name.length > 30)
    return `is ${name.length} characters; the App Store cap is 30`;
  if (!name.trim()) return 'is empty';
  return null;
}

// ---------------------------------------------------------------------------
// Repo wiring. Surgical edits — read, set, write — so key order and every
// unrelated field survive untouched.
// ---------------------------------------------------------------------------
function writeEasJson(path, { ascAppId, appleTeamId }) {
  if (!existsSync(path)) return null;
  const j = JSON.parse(readFileSync(path, 'utf-8'));
  j.submit ??= {};
  j.submit.production ??= {};
  j.submit.production.ios ??= {};
  const ios = j.submit.production.ios;
  const before = JSON.stringify(ios);
  ios.ascAppId = ascAppId;
  if (appleTeamId) ios.appleTeamId = appleTeamId;
  // `appleId` is deliberately never written. It is a personal email address and
  // this file is committed; `eas submit` prompts once and caches it locally, so
  // omitting it costs nothing. The Team ID is different in kind — it identifies
  // an organisation and appears in every app's receipt.
  delete ios.appleId;
  if (JSON.stringify(ios) === before) return 'unchanged';
  if (!DRY) writeFileSync(path, JSON.stringify(j, null, 2) + '\n');
  return 'written';
}

function writeAppJson(path, { bundleId }) {
  if (!existsSync(path)) return null;
  const j = JSON.parse(readFileSync(path, 'utf-8'));
  j.expo ??= {};
  j.expo.ios ??= {};
  const before = JSON.stringify(j.expo.ios);
  j.expo.ios.bundleIdentifier = bundleId;
  j.expo.ios.infoPlist ??= {};
  // Without this every TestFlight upload stops in "Missing Compliance" and stays
  // invisible to testers until someone answers the export question by hand. It is
  // not an error, nothing emails you, the build simply never appears.
  j.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption = false;
  if (JSON.stringify(j.expo.ios) === before) return 'unchanged';
  if (!DRY) writeFileSync(path, JSON.stringify(j, null, 2) + '\n');
  return 'written';
}

const ask = (q) =>
  new Promise((r) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(q, (a) => {
      rl.close();
      r(a.trim());
    });
  });

// ---------------------------------------------------------------------------
async function main() {
  if (has('help') || process.argv.length < 3) {
    showHelp();
    process.exit(has('help') ? EXIT.OK : EXIT.FAIL);
  }

  const storeName = process.argv[2];
  const bundleId = arg('bundle-id');
  // The SKU must be unique across the whole account, so it CANNOT default to
  // the bundle id's last segment: `com.geolarp.app` and `com.scripthammer.app`
  // both end in "app", and the second claim would collide. Derive it from the
  // store name instead, which is the thing that is actually distinct.
  const sku = arg(
    'sku',
    storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
  const locale = arg('locale', 'en-US');
  const easPath = arg('eas-json', 'eas.json');
  const appPath = arg('app-json', 'app.json');

  if (!bundleId)
    die(
      EXIT.FAIL,
      '--bundle-id is required.',
      '  e.g. --bundle-id com.geolarp.app'
    );

  const nameErr = validateStoreName(storeName);
  if (nameErr) die(EXIT.FAIL, `Store name ${nameErr}.`);
  const bidErr = validateBundleId(bundleId);
  if (bidErr) die(EXIT.FAIL, `Bundle id invalid: ${bidErr}.`);

  if (!JSON_OUT) {
    console.log(
      `\n  Claiming "${storeName}"  ${DRY ? '(DRY RUN — no writes)' : ''}\n`
    );
  }

  const creds = resolveKey();
  const token = makeJWT(creds);
  say('✓', `key ${creds.keyId}, issuer ${creds.issuerId.slice(0, 8)}…`);

  // --- bundle id ---------------------------------------------------------
  let bundle = null;
  const found = await asc(
    token,
    'GET',
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&limit=200`
  );
  bundle =
    (found.data || []).find((b) => b.attributes?.identifier === bundleId) ||
    null;

  if (bundle) {
    say('✓', `bundle id ${bundleId} already registered`);
  } else if (DRY) {
    say(
      '·',
      `bundle id ${bundleId} would be REGISTERED (permanent, unrecoverable)`
    );
  } else {
    if (!has('force')) {
      console.log(
        `\n  ${bundleId} is not registered yet.\n` +
          `  Registering it is PERMANENT — Apple never re-issues a deleted identifier.\n`
      );
      const a = await ask('  Type the bundle id to confirm: ');
      if (a !== bundleId) die(EXIT.DECLINED, 'Not confirmed.');
    }
    const created = await asc(token, 'POST', '/v1/bundleIds', {
      data: {
        type: 'bundleIds',
        // IOS, never UNIVERSAL — Apple rejects UNIVERSAL as an invalid value for
        // this attribute, with an error that does not say which value it wanted.
        attributes: { identifier: bundleId, name: storeName, platform: 'IOS' },
      },
    });
    bundle = created.data;
    say('✓', `bundle id ${bundleId} registered`);
  }
  if (bundle?.attributes?.seedId)
    say('·', `team ${bundle.attributes.seedId} (App ID Prefix)`);

  // --- the app record ----------------------------------------------------
  const appsRes = await asc(
    token,
    'GET',
    `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=200`
  );
  let app = (appsRes.data || [])[0] || null;

  if (!app) {
    const teamId =
      bundle?.attributes?.seedId ||
      '(see Certificates, Identifiers & Profiles)';
    const block = [
      '',
      '  ─────────────────────────────────────────────────────────────────',
      '   ONE STEP LEFT, AND APPLE WILL NOT LET US DO IT',
      '  ─────────────────────────────────────────────────────────────────',
      '',
      '   POST /v1/apps is FORBIDDEN on the public API — `apps` allows only',
      '   GET_COLLECTION, GET_INSTANCE and UPDATE. The record must be created',
      '   in a browser. That is the whole gap; everything either side is done.',
      '',
      '   Open:  https://appstoreconnect.apple.com/apps  →  +  →  New App',
      '',
      '   Paste these. Nothing here needs a decision:',
      '',
      '     Platforms          iOS',
      `     Name               ${storeName}${' '.repeat(Math.max(0, 24 - storeName.length))}← ${storeName.length}/30 chars`,
      `     Primary Language   ${locale === 'en-US' ? 'English (U.S.)' : locale}`,
      `     Bundle ID          ${bundleId}   ← pick from the dropdown`,
      `     SKU                ${sku}`,
      '     User Access        Full Access',
      '',
      `   Team: ${teamId}`,
      '',
      '   Then: App Information → General Information → copy the Apple ID',
      '         (a 10-digit number)',
      '  ─────────────────────────────────────────────────────────────────',
    ].join('\n');

    if (DRY || JSON_OUT) {
      if (!JSON_OUT) console.log(block);
      say('·', 'app record does not exist — a human must create it');
      if (JSON_OUT)
        console.log(
          JSON.stringify(
            {
              ok: false,
              exit: EXIT.WAITING,
              bundleId,
              storeName,
              sku,
              ...report,
            },
            null,
            2
          )
        );
      process.exit(EXIT.WAITING);
    }

    console.log(block);
    const pasted = await ask('\n  Paste the Apple ID, or Enter to poll: ');
    if (pasted) {
      app = (await asc(token, 'GET', `/v1/apps/${encodeURIComponent(pasted)}`))
        .data;
    } else {
      // Poll on the bundle id we just registered — it is the join key, so the
      // human never has to transcribe anything. Ctrl-C is safe; re-running
      // resumes, because every step above reads before it writes.
      process.stdout.write('  waiting');
      for (let i = 0; i < 120 && !app; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        process.stdout.write('.');
        const r = await asc(
          token,
          'GET',
          `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=200`
        );
        app = (r.data || [])[0] || null;
      }
      console.log('');
    }
    if (!app)
      die(EXIT.WAITING, 'Timed out waiting for the record. Re-run to resume.');
  }

  // The one browser mistake that cannot be undone is creating the record against
  // the wrong bundle id. Check it rather than trust it.
  if (app.attributes?.bundleId && app.attributes.bundleId !== bundleId) {
    die(
      EXIT.FAIL,
      `App ${app.id} is bound to ${app.attributes.bundleId}, not ${bundleId}.`,
      '  The record was created against the wrong identifier. That cannot be changed.'
    );
  }
  const ascAppId = app.id;
  say('✓', `app record ${ascAppId} — bundleId verified`);

  // --- the listing name, which is also the availability check --------------
  try {
    const infos = await asc(token, 'GET', `/v1/apps/${ascAppId}/appInfos`);
    const info = (infos.data || [])[0];
    if (info) {
      const locs = await asc(
        token,
        'GET',
        `/v1/appInfos/${info.id}/appInfoLocalizations`
      );
      const loc = (locs.data || []).find(
        (l) => l.attributes?.locale === locale
      );
      if (!loc) {
        warn(`no ${locale} localization yet — set the name in the browser`);
      } else if (loc.attributes.name === storeName) {
        say('✓', `listing name already "${storeName}"`);
      } else if (DRY) {
        say(
          '·',
          `listing name would change "${loc.attributes.name}" → "${storeName}"`
        );
      } else {
        await asc(token, 'PATCH', `/v1/appInfoLocalizations/${loc.id}`, {
          data: {
            type: 'appInfoLocalizations',
            id: loc.id,
            attributes: { name: storeName },
          },
        });
        // Apple refuses a name that is taken. Acceptance IS the availability
        // check — there is no other authoritative one, and the published-app
        // search API cannot see reserved-but-unpublished names at all.
        say(
          '✓',
          `listing name "${storeName}" ACCEPTED — that is the availability check`
        );
      }
    }
  } catch (e) {
    if (e.status === 409 || /unavailable|already/i.test(e.message)) {
      die(
        EXIT.FAIL,
        `App Store Connect refused the name "${storeName}".`,
        `  Apple said:\n      ${e.message.split('\n').slice(1).join('\n')}\n\n` +
          '  A refusal means the name is taken. Suffixes create uniqueness;\n' +
          '  casing does not — "geoLARP" and "GeoLarp" are the same name to Apple.'
      );
    }
    throw e;
  }

  // --- repo wiring --------------------------------------------------------
  const teamId = bundle?.attributes?.seedId;
  const e = writeEasJson(easPath, { ascAppId, appleTeamId: teamId });
  const a = writeAppJson(appPath, { bundleId });
  if (e)
    say(
      e === 'written' ? '✓' : '·',
      `${easPath} ${e}${DRY ? ' (dry run)' : ''}`
    );
  else
    warn(
      `no ${easPath} here — recorded nothing. Re-run inside the Expo project.`
    );
  if (a)
    say(
      a === 'written' ? '✓' : '·',
      `${appPath} ${a}${DRY ? ' (dry run)' : ''}`
    );
  else
    warn(
      `no ${appPath} here — recorded nothing. Re-run inside the Expo project.`
    );

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          exit: EXIT.OK,
          ascAppId,
          bundleId,
          storeName,
          teamId,
          ...report,
        },
        null,
        2
      )
    );
  } else {
    console.log('\n  Done.\n');
    console.log(
      '  This does NOT prove: that the name survives review, that the app'
    );
    console.log(
      '  builds on iOS, or that the listing is submittable — screenshots,'
    );
    console.log(
      '  age rating, privacy answers and the review demo account are all'
    );
    console.log('  still open.\n');
  }
}

main().catch((err) => die(EXIT.FAIL, err.message));
