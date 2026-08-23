const assert = require('node:assert/strict');
const {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  symlinkSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { describe, test } = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'rebrand.sh');
const HELPER = path.join(ROOT, 'scripts', 'rebrand-case.mjs');

const helper = import(pathToFileURL(HELPER).href);

const identity = async (
  targetDisplay = 'GeoLarp', // rebrand:keep
  targetSlug = 'geolarp', // rebrand:keep
  targetComponent = 'GeoLarp' // rebrand:keep
) => {
  const { createIdentity } = await helper;
  return createIdentity({
    sourceDisplay: 'ScriptHammer', // rebrand:keep
    sourceSlug: 'scripthammer', // rebrand:keep
    sourceComponent: 'ScriptHammer', // rebrand:keep
    sourceUpper: 'SCRIPTHAMMER', // rebrand:keep
    targetDisplay,
    targetSlug,
    targetComponent,
  });
};

describe('case-preserving rebrand transform (#933)', () => {
  test('maps every real style plus an arbitrary mixed spelling', async () => {
    const { replaceBrandText } = await helper;
    const result = replaceBrandText(
      [
        'ScriptHammer', // rebrand:keep
        'scripthammer', // rebrand:keep
        'Scripthammer', // rebrand:keep
        'SCRIPTHAMMER', // rebrand:keep
        'ScriptHAMMER', // rebrand:keep
      ].join('\n'),
      await identity()
    );

    assert.deepEqual(result.split('\n'), [
      'GeoLarp', // rebrand:keep
      'geolarp', // rebrand:keep
      'Geolarp', // rebrand:keep
      'GEOLARP', // rebrand:keep
      'GeoLarp', // rebrand:keep
    ]);
  });

  test('keeps identifiers valid for a display name with spaces', async () => {
    const { replaceBrandText } = await helper;
    const result = replaceBrandText(
      [
        'prose: ScriptHammer', // rebrand:keep
        'const ScriptHammerLogo = true;', // rebrand:keep
        'const scripthammerCaches = true;', // rebrand:keep
        'const __scripthammer_syncQueue = true;', // rebrand:keep
        'function cleanupStaleScripthammerUsers() {}', // rebrand:keep
        "const SCRIPTHAMMER_TEST_DOMAIN = '@scripthammer.test';", // rebrand:keep
      ].join('\n'),
      await identity('geo LARP', 'geo-larp', 'GeoLARP') // rebrand:keep
    );

    assert.deepEqual(result.split('\n'), [
      'prose: geo LARP',
      'const GeoLARPLogo = true;', // rebrand:keep
      'const geolarpCaches = true;', // rebrand:keep
      'const __geolarp_syncQueue = true;', // rebrand:keep
      'function cleanupStaleGeolarpUsers() {}', // rebrand:keep
      "const GEOLARP_TEST_DOMAIN = '@geo-larp.test';", // rebrand:keep
    ]);
  });

  test('keeps marked lines byte-exact and independently finds unmarked survivors', async () => {
    const { replaceBrandText, findBrandSurvivors } = await helper;
    const source = [
      'SCRIPTHAMMER + ScriptHAMMER // rebrand:keep',
      'Scripthammer must move', // rebrand:keep
      '',
    ].join('\r\n');
    const transformed = replaceBrandText(source, await identity());

    assert.equal(
      transformed,
      [
        'SCRIPTHAMMER + ScriptHAMMER // rebrand:keep',
        'Geolarp must move', // rebrand:keep
        '',
      ].join('\r\n')
    );
    assert.deepEqual(findBrandSurvivors(source, await identity()), [
      { line: 2, text: 'Scripthammer must move' }, // rebrand:keep
    ]);
    assert.deepEqual(findBrandSurvivors(transformed, await identity()), []);
  });

  test('maps every path component with a path-safe projection', async () => {
    const { mapBrandPath } = await helper;
    assert.equal(
      mapBrandPath(
        'public/blog-images/scripthammer-intro/ScripthammerBadge-SCRIPTHAMMER.svg', // rebrand:keep
        await identity('geo LARP', 'geo-larp', 'GeoLARP') // rebrand:keep
      ),
      'public/blog-images/geo-larp-intro/GeolarpBadge-GEOLARP.svg' // rebrand:keep
    );
  });

  test('rewrites textual path references to the exact mapped path', async () => {
    const { mapBrandPath, replaceBrandText } = await helper;
    const currentIdentity = await identity('geo LARP', 'geo-larp', 'GeoLARP'); // rebrand:keep
    const oldPath = 'docs/design/ScriptHammer-Guide.md'; // rebrand:keep
    const expected = 'docs/design/GeoLARP-Guide.md'; // rebrand:keep

    assert.equal(mapBrandPath(oldPath, currentIdentity), expected);
    assert.equal(
      replaceBrandText(`Read ${oldPath}`, currentIdentity),
      `Read ${expected}`
    );
  });

  test('keeps escaped generated text in sync with its source content', async () => {
    const { replaceBrandText } = await helper;
    const currentIdentity = await identity('geo LARP', 'geo-larp', 'GeoLARP'); // rebrand:keep
    const markdown = [
      '# ScriptHammer architecture', // rebrand:keep
      'Scripthammer ships from /docs/ScriptHammer-Guide.md.', // rebrand:keep
      '**Hardcoded values still showing "ScriptHammer":**', // rebrand:keep
    ].join('\n');
    const transformedSource = replaceBrandText(markdown, currentIdentity);
    const transformedIndex = replaceBrandText(
      JSON.stringify({ content: markdown }),
      currentIdentity
    );

    assert.equal(JSON.parse(transformedIndex).content, transformedSource);
    assert.match(transformedSource, /# geo LARP architecture/); // rebrand:keep
    assert.match(transformedSource, /Geo larp ships/); // rebrand:keep
    assert.match(transformedSource, /\/docs\/GeoLARP-Guide\.md/); // rebrand:keep
    assert.match(transformedSource, /showing "geo LARP"/); // rebrand:keep
  });

  test('does not collide with an existing target identifier', async () => {
    const { replaceBrandText } = await helper;
    const footer = readFileSync(
      path.join(ROOT, 'src', 'components', 'Footer.tsx'),
      'utf8'
    );
    const transformed = replaceBrandText(
      footer,
      await identity('geo LARP', 'geo-larp', 'GeoLARP') // rebrand:keep
    );
    const declaration = transformed.match(/const \[([^\]]+)] = FOOTER_LINKS/);
    assert.ok(
      declaration,
      'expected the footer link destructuring declaration'
    );
    const names = declaration[1].split(',').map((name) => name.trim());
    assert.equal(new Set(names).size, names.length);
  });

  test('uses exact stored title projections during re-rebrand', async () => {
    const { createIdentity, replaceBrandText } = await helper;
    const transition = createIdentity({
      sourceDisplay: 'Geolarp', // rebrand:keep
      sourceSlug: 'geolarp', // rebrand:keep
      sourceComponent: 'Geolarp', // rebrand:keep
      sourceUpper: 'GEOLARP', // rebrand:keep
      targetDisplay: 'Second App',
      targetSlug: 'second-app',
      targetComponent: 'SecondApp',
    });
    assert.equal(
      replaceBrandText(
        '# Geolarp\nconst GeolarpLogo = true;', // rebrand:keep
        transition
      ),
      '# Second App\nconst SecondAppLogo = true;'
    );
  });

  test('rejects source-containing targets and ambiguous re-rebrand state', async () => {
    const { createIdentity, validateIdentityTransition } = await helper;
    const sourceContaining = await identity(
      'ScriptHammer Pro', // rebrand:keep
      'scripthammer-pro', // rebrand:keep
      'ScriptHammerPro' // rebrand:keep
    );
    assert.throws(
      () => validateIdentityTransition(sourceContaining),
      /target identity still contains the current brand/
    );

    const ambiguous = createIdentity({
      sourceDisplay: 'geolarp', // rebrand:keep
      sourceSlug: 'geolarp', // rebrand:keep
      sourceComponent: 'Geolarp', // rebrand:keep
      sourceUpper: 'GEOLARP', // rebrand:keep
      targetDisplay: 'Second App',
      targetSlug: 'second-app',
      targetComponent: 'SecondApp',
    });
    assert.throws(
      () => validateIdentityTransition(ambiguous),
      /automated re-rebrand is unsafe/
    );
  });

  test('rejects source identities that collide with stable runtime tooling', async () => {
    const { createIdentity, validateRuntimePaths } = await helper;
    const root = mkdtempSync(path.join(tmpdir(), 'rebrand-runtime-'));
    try {
      mkdirSync(path.join(root, 'scripts'));
      writeFileSync(
        path.join(root, 'scripts', 'stable.mjs'),
        "import fs from 'node:fs';\n"
      );
      const nodeIdentity = createIdentity({
        sourceDisplay: 'Node',
        sourceSlug: 'node',
        sourceComponent: 'Node',
        sourceUpper: 'NODE',
        targetDisplay: 'Second App',
        targetSlug: 'second-app',
        targetComponent: 'SecondApp',
      });
      assert.throws(
        () => validateRuntimePaths(root, nodeIdentity, ['scripts/stable.mjs']),
        /stable rebrand tooling/
      );

      const rebrandIdentity = createIdentity({
        sourceDisplay: 'Rebrand',
        sourceSlug: 'rebrand',
        sourceComponent: 'Rebrand',
        sourceUpper: 'REBRAND',
        targetDisplay: 'Second App',
        targetSlug: 'second-app',
        targetComponent: 'SecondApp',
      });
      assert.throws(
        () =>
          validateRuntimePaths(root, rebrandIdentity, ['scripts/rebrand.sh']),
        /stable rebrand tooling/
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('preflights case-folding collisions before moving either source', async () => {
    const { planPathRenames } = await helper;
    const currentIdentity = await identity();
    const root = mkdtempSync(path.join(tmpdir(), 'rebrand-collision-'));
    try {
      mkdirSync(path.join(root, 'docs'));
      const upper = path.join(root, 'docs', 'SCRIPTHAMMER.md'); // rebrand:keep
      const lower = path.join(root, 'docs', 'scripthammer.md'); // rebrand:keep
      writeFileSync(upper, 'upper');
      writeFileSync(lower, 'lower');

      assert.throws(
        () => planPathRenames(root, [upper, lower], currentIdentity),
        /rebrand path collision/
      );
      assert.equal(readFileSync(upper, 'utf8'), 'upper');
      assert.equal(readFileSync(lower, 'utf8'), 'lower');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('rejects merging a renamed source into an existing target directory', async () => {
    const { planPathRenames } = await helper;
    const currentIdentity = await identity();
    const root = mkdtempSync(path.join(tmpdir(), 'rebrand-directory-'));
    try {
      const source = path.join(root, 'assets', 'scripthammer-intro'); // rebrand:keep
      const target = path.join(root, 'assets', 'geolarp-intro'); // rebrand:keep
      mkdirSync(source, { recursive: true });
      mkdirSync(target, { recursive: true });
      const sourceFile = path.join(source, 'source.bin');
      writeFileSync(sourceFile, 'source');
      writeFileSync(path.join(target, 'sentinel.bin'), 'target');

      assert.throws(
        () => planPathRenames(root, [sourceFile], currentIdentity),
        /rebrand target directory already exists/
      );
      assert.equal(readFileSync(sourceFile, 'utf8'), 'source');
      assert.equal(
        readFileSync(path.join(target, 'sentinel.bin'), 'utf8'),
        'target'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('rejects a target that would be both a file and a directory', async () => {
    const { planPathRenames } = await helper;
    const currentIdentity = await identity();
    const root = mkdtempSync(path.join(tmpdir(), 'rebrand-file-directory-'));
    try {
      const oldFile = path.join(root, 'ScriptHammer'); // rebrand:keep
      const oldDirectory = path.join(root, 'ScriptHAMMER'); // rebrand:keep
      const child = path.join(oldDirectory, 'child.txt');
      mkdirSync(oldDirectory, { recursive: true });
      writeFileSync(oldFile, 'file');
      writeFileSync(child, 'child');

      assert.throws(
        () => planPathRenames(root, [oldFile, child], currentIdentity),
        /rebrand file\/directory collision/
      );
      assert.equal(readFileSync(oldFile, 'utf8'), 'file');
      assert.equal(readFileSync(child, 'utf8'), 'child');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('rejects a tracked symlink target that a directory rename would break', async () => {
    const { planPathRenames } = await helper;
    const currentIdentity = await identity();
    const root = mkdtempSync(path.join(tmpdir(), 'rebrand-symlink-'));
    try {
      const target = path.join(root, 'assets', 'scripthammer', 'data.txt'); // rebrand:keep
      const link = path.join(root, 'current');
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, 'data');
      symlinkSync('assets/scripthammer/data.txt', link); // rebrand:keep

      assert.throws(
        () => planPathRenames(root, [target, link], currentIdentity),
        /tracked symlink target contains the current brand/
      );
      assert.equal(existsSync(link), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('renames a brand directory without touching binary bytes', async () => {
    const { planPathRenames, applyPathRenames } = await helper;
    const root = mkdtempSync(path.join(tmpdir(), 'rebrand-binary-'));
    try {
      const oldDirectory = path.join(root, 'assets', 'scripthammer-intro'); // rebrand:keep
      const oldFile = path.join(oldDirectory, 'plain.bin');
      const expected = Buffer.from('before\0Scripthammer\0after'); // rebrand:keep
      mkdirSync(oldDirectory, { recursive: true });
      writeFileSync(oldFile, expected);

      const plan = planPathRenames(root, [oldFile], await identity());
      applyPathRenames(root, plan);

      const newFile = path.join(root, 'assets', 'geolarp-intro', 'plain.bin'); // rebrand:keep
      assert.deepEqual(readFileSync(newFile), expected);
      assert.equal(existsSync(oldDirectory), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const contractErrors = (source) => {
  const code = source
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  const errors = [];
  const validate = code.lastIndexOf('\n        validate_brand_target\n');
  const indexGuard = code.lastIndexOf('\n        assert_index_paths_current\n');
  const preflight = code.lastIndexOf('        preflight_brand_paths');
  const replace = code.lastIndexOf('        replace_brand_in_files');
  const rename = code.lastIndexOf('        rename_brand_paths');
  const icons = code.lastIndexOf('    update_brand_icons');
  const verify = code.lastIndexOf('\n        assert_no_old_brand\n');

  if (validate === -1 || preflight === -1 || validate > preflight) {
    errors.push('target validation must run before path preflight');
  }
  if (indexGuard === -1 || preflight === -1 || indexGuard > preflight) {
    errors.push('stale-index validation must run before path preflight');
  }
  if (preflight === -1 || replace === -1 || preflight > replace) {
    errors.push('path collision preflight must run before content mutation');
  }
  if (replace === -1)
    errors.push('case-preserving content transform is not called');
  if (rename === -1 || rename < replace)
    errors.push('full tracked-path transform is not called after content');
  if (verify === -1 || verify < icons)
    errors.push('postcondition is not called after all writes');
  if (!/case_helper verify-paths < "\$TRACKED_SNAPSHOT"/.test(code))
    errors.push('postcondition does not scan every tracked path');
  if (/\n\s*rename_files\s/.test(code))
    errors.push('legacy basename-only rename call remains');
  return errors;
};

describe('rebrand.sh wiring contract (#933)', () => {
  const source = readFileSync(SCRIPT, 'utf8');

  test('the live workflow has preflight, transform, path mapping, and postcondition in order', () => {
    assert.deepEqual(contractErrors(source), []);
  });

  test('controls reject removing the residual gate', () => {
    const mutant = source.replace(
      '        assert_no_old_brand\n',
      '        : # residual gate removed\n'
    );
    assert.ok(
      contractErrors(mutant).includes(
        'postcondition is not called after all writes'
      )
    );
  });

  test('controls reject disconnecting target validation from the workflow', () => {
    const mutant = source.replace('        validate_brand_target\n', '');
    assert.ok(
      contractErrors(mutant).includes(
        'target validation must run before path preflight'
      )
    );
  });

  test('controls reject disconnecting stale-index validation from the workflow', () => {
    const mutant = source.replace('        assert_index_paths_current\n', '');
    assert.ok(
      contractErrors(mutant).includes(
        'stale-index validation must run before path preflight'
      )
    );
  });

  test('controls reject moving collision detection after content writes', () => {
    const mutant = source
      .replace('        preflight_brand_paths\n', '')
      .replace(
        '        replace_brand_in_files\n',
        '        replace_brand_in_files\n        preflight_brand_paths\n'
      );
    assert.ok(
      contractErrors(mutant).includes(
        'path collision preflight must run before content mutation'
      )
    );
  });

  test('controls reject restoring the basename-only path call', () => {
    const mutant = source.replace(
      '        rename_brand_paths\n',
      '        rename_files "$ORIGINAL_NAME" "$COMPONENT_NAME"\n'
    );
    const errors = contractErrors(mutant);
    assert.ok(
      errors.includes('full tracked-path transform is not called after content')
    );
    assert.ok(errors.includes('legacy basename-only rename call remains'));
  });
});

test('brand fixtures in this regression file remain stable in a fork', () => {
  const unmarked = readFileSync(__filename, 'utf8')
    .split(/\r?\n/)
    .filter(
      (line) =>
        /(scripthammer|geolarp)/i.test(line) && // rebrand:keep
        !line.includes('rebrand:keep')
    );
  assert.deepEqual(unmarked, []);
});
