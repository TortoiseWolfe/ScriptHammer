/**
 * The repo's ESLint config must load without pnpm's NODE_PATH injection (#1177).
 *
 * WHAT WENT WRONG. `eslint.config.mjs` pulls in `eslint-config-next` through FlatCompat,
 * and `eslint-config-next/index.js` extends `plugin:react-hooks/recommended`. Its
 * `hookPropertyMap` patches module resolution for exactly four plugins —
 * `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `eslint-plugin-react`,
 * `eslint-plugin-jsx-a11y` — and `eslint-plugin-react-hooks` is not one of them. So the
 * plugin was resolved by NAME from the repo root, while this repo never declared it: it
 * existed only as a transitive dependency under `node_modules/.pnpm/node_modules`,
 * reachable solely because pnpm injects that directory via NODE_PATH.
 *
 * WHY IT LOOKED FINE. `pnpm lint` in CI runs under pnpm, so NODE_PATH was always set and
 * the config always loaded. The pre-commit hook's HOST-native lint-staged branch does
 * not, and there it failed with `ESLint couldn't find the plugin
 * "eslint-plugin-react-hooks"` — exit 2, measured on this machine while the identical
 * command inside the container exited 0. A config that loads only under one launcher is
 * not configured, it is coincidental.
 *
 * WHY `env -u NODE_PATH` IS THE WHOLE TEST. `pnpm test:scripts` itself runs under pnpm.
 * Without deleting NODE_PATH in the child, this passes today, before any fix, and proves
 * nothing — the exact probe-that-cannot-fail shape this repo keeps paying for. Run the
 * mutation: remove the devDependency and this must go red.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PLUGIN = 'eslint-plugin-react-hooks';

describe('ESLint config loads without pnpm (#1177)', () => {
  it(`declares ${PLUGIN}, because the config requires it by name`, () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    );
    const declared = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    assert.ok(
      declared[PLUGIN],
      `${PLUGIN} is not declared in package.json. eslint-config-next extends ` +
        '`plugin:react-hooks/recommended` and does NOT map this plugin in its ' +
        'hookPropertyMap, so ESLint resolves it by name from the repo root. Undeclared, ' +
        "it is reachable only through pnpm's NODE_PATH injection and the pre-commit " +
        'hook cannot load the config at all (#1177).'
    );
  });

  it('resolves the plugin BY NAME from the repo root, the way ESLint does', () => {
    // NOT `eslint --print-config` with NODE_PATH deleted. That was the first version of
    // this assertion and it was VACUOUS in the container: `node_modules/.bin/eslint`
    // resolves through `.pnpm/<pkg>/node_modules/...`, so Node keeps finding the plugin
    // via the realpath chain even with the root link gone and NODE_PATH unset. It passed
    // the mutation, which means it was testing nothing — measured, not assumed.
    //
    // This models what actually broke: ESLint resolves a plugin by name from the config's
    // baseDirectory, which FlatCompat sets to the repo root. `paths: [ROOT]` is that
    // lookup, and it does not consult `.pnpm/node_modules`.
    assert.doesNotThrow(
      () => require.resolve(PLUGIN, { paths: [ROOT] }),
      `${PLUGIN} does not resolve by name from ${ROOT}. That is the lookup ESLint ` +
        'performs for a plugin named in an extended config, so the pre-commit hook ' +
        'cannot load the config at all (#1177).'
    );
  });

  it('and the binary that the hook invokes still exists', () => {
    // COULD-NOT-RUN IS NOT A PASS. Skipping would make this green in exactly the
    // environment that cannot check it, which is how the defect survived.
    const bin = path.join(ROOT, 'node_modules', '.bin', 'eslint');
    assert.ok(
      fs.existsSync(bin),
      `${bin} is missing, so the hook has nothing to run. Install dependencies in ` +
        'Docker and re-run; this is not a pass.'
    );
    const res = spawnSync(bin, ['--print-config', 'src/app/page.tsx'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.strictEqual(
      res.status,
      0,
      `eslint --print-config failed.\n\n${(res.stderr || '').slice(0, 600)}`
    );
  });
});
