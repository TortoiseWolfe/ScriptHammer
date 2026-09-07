/**
 * The App Store metadata generator must refuse to invent things (#1086).
 *
 * `eas metadata:push` sends this file's contents to Apple as public claims about a product.
 * So the interesting assertions here are NEGATIVE: that the generator leaves a marker where
 * it does not know something, rather than a plausible-sounding guess. A guess reads as
 * finished and ships as a promise, which is how a sibling project came to publish a
 * data-retention commitment its system did not honour.
 *
 * The credential assertion is the other half. `review.demoPassword` names a real account, and
 * this file is gitignored for that reason — but a rule only helps if the generator never
 * writes the value in the first place.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const MODULE = path.resolve(__dirname, '..', 'generate-store-config.mjs');
const load = () => import(`file://${MODULE}`);

describe('store.config.json generator (#1086)', () => {
  it('derives the three URL fields from a configured domain', async () => {
    const { buildStoreConfig } = await load();
    const info = buildStoreConfig({
      domain: 'www.example.com',
      owner: 'Example Co',
      name: 'Demo App',
      year: 2026,
    }).apple.info['en-US'];

    assert.strictEqual(
      info.privacyPolicyUrl,
      'https://www.example.com/privacy/'
    );
    assert.strictEqual(info.supportUrl, 'https://www.example.com/contact/');
    assert.strictEqual(info.marketingUrl, 'https://www.example.com/');
    assert.strictEqual(info.title, 'Demo App');
  });

  it('marks URLs TODO rather than guessing when no domain is configured', async () => {
    // A wrong support URL is worse than a missing one: Apple accepts it, and a real user
    // hits a 404 at the moment they are asking for help.
    const { buildStoreConfig, TODO } = await load();
    const info = buildStoreConfig({ domain: null, owner: 'X', year: 2026 })
      .apple.info['en-US'];
    assert.strictEqual(info.supportUrl, TODO);
    assert.strictEqual(info.privacyPolicyUrl, TODO);
    assert.strictEqual(info.marketingUrl, TODO);
  });

  it('NEVER writes marketing copy', async () => {
    // The load-bearing assertion. If this ever fails, someone taught the generator to be
    // helpful, and the output became a set of claims nobody wrote.
    const { buildStoreConfig, TODO } = await load();
    const info = buildStoreConfig({
      domain: 'www.example.com',
      owner: 'Example Co',
      name: 'Demo App',
      year: 2026,
    }).apple.info['en-US'];

    assert.strictEqual(info.description, TODO);
    assert.strictEqual(info.promoText, TODO);
    assert.strictEqual(info.subtitle, TODO);
    assert.deepStrictEqual(info.keywords, [TODO]);
  });

  it('writes the NAME of the password variable, never a value', async () => {
    const { buildStoreConfig } = await load();
    const review = buildStoreConfig({ year: 2026 }).apple.review;
    assert.strictEqual(review.demoPassword, '$APPSTORE_DEMO_PASSWORD');
  });

  it('does not leak a real password even when one is in the environment', async () => {
    // The mutation that matters: a generator that reads the env "to be convenient" would
    // write a live credential into a file a human then commits.
    const { buildStoreConfig } = await load();
    const before = process.env.APPSTORE_DEMO_PASSWORD;
    process.env.APPSTORE_DEMO_PASSWORD = 'hunter2-should-never-appear';
    try {
      const json = JSON.stringify(buildStoreConfig({ year: 2026 }));
      assert.ok(
        !json.includes('hunter2-should-never-appear'),
        'the generated config contains a real password value'
      );
    } finally {
      if (before === undefined) delete process.env.APPSTORE_DEMO_PASSWORD;
      else process.env.APPSTORE_DEMO_PASSWORD = before;
    }
  });

  it('never auto-releases', async () => {
    // `automaticRelease: true` means the next successful review goes live with no human in
    // the loop. That must be a deliberate edit, never a default.
    const { buildStoreConfig } = await load();
    assert.strictEqual(
      buildStoreConfig({ year: 2026 }).apple.release.automaticRelease,
      false
    );
  });

  it('reports every field still needing a human', async () => {
    const { buildStoreConfig, pendingFields } = await load();
    const pending = pendingFields(
      buildStoreConfig({
        domain: 'www.example.com',
        owner: 'Example Co',
        name: 'Demo App',
        year: 2026,
      })
    );

    // Counterweight: the list must be non-empty AND must not contain what we derived, or
    // it is either vacuous or lying about the work left.
    assert.ok(pending.length > 0, 'nothing reported as pending');
    assert.ok(pending.some((p) => p.endsWith('description')));
    assert.ok(
      !pending.some((p) => p.endsWith('supportUrl')),
      'supportUrl was derived and must not be listed as pending'
    );
  });

  it('the generated file is gitignored', async () => {
    // The rule and the generator are one mechanism; either alone is insufficient.
    const root = path.resolve(__dirname, '..', '..');
    const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    assert.match(ignore, /^store\.config\.json$/m);
  });

  it('writes a file end to end, into a temp dir', async () => {
    const { main } = await load();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storecfg-'));
    const out = path.join(dir, 'store.config.json');
    const log = console.log;
    console.log = () => {};
    try {
      main(['--out', out, '--name', 'Demo App']);
    } finally {
      console.log = log;
    }
    const written = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.strictEqual(written.apple.info['en-US'].title, 'Demo App');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
