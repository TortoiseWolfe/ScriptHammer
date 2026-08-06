#!/usr/bin/env node

/**
 * Component Structure Audit Tool
 * Analyzes React components for 4-file pattern compliance
 */

'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * The repo root, derived from this file rather than the cwd, so
 * KNOWN_BARE_COMPONENTS keys resolve the same way no matter where the
 * validator is invoked from.
 */
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Every component that existed as a bare `<Name>.tsx` rather than a five-file
 * directory when this discovery was written (#538). A RATCHET, not a pardon.
 *
 * Before #538 the discovery step only ever enumerated directories, so a bare
 * file could not be reported as non-compliant — it was structurally invisible,
 * and the validator printed 100% while these sat outside the pattern it exists
 * to enforce. Not being enumerated is not the same as passing, but it reads
 * identically in the summary.
 *
 * TWO THINGS FOLLOW, AND THEY ARE DELIBERATELY DIFFERENT:
 *
 *   - Every entry here counts as NON-COMPLIANT in the reported rate. That is
 *     why the number dropped from a false 100%. The rate tells the truth.
 *   - The BUILD fails only on a bare component that is NOT recorded here. The
 *     existing debt is visible and tracked (#547); a NEW one is a regression.
 *
 * So this list may shrink and must never grow. Adding an entry to make a run
 * green is the exact failure catalogued in #396 — if you are tempted, the
 * component wants its four files instead.
 *
 * #538 named six of these. The discovery found seventeen.
 */
const KNOWN_BARE_COMPONENTS = {
  // App-shell singletons, all mounted directly in src/app/layout.tsx.
  'src/components/AccessibilityScript.tsx':
    'Inlined <script>, must run before hydration — no rendered DOM to story or axe',
  'src/components/ThemeScript.tsx':
    'Inlined <script>, must run before hydration — no rendered DOM to story or axe',
  'src/components/ErrorBoundary.tsx':
    'Class component wrapping the whole tree in layout.tsx',
  'src/components/Footer.tsx': 'App-shell singleton mounted in layout.tsx',
  'src/components/GlobalNav.tsx':
    'App-shell singleton mounted in layout.tsx — 837 lines, the strongest candidate to move',
  'src/components/PWAInstall.tsx': 'App-shell singleton mounted in layout.tsx',

  // Ordinary components that simply never adopted the pattern. #538 did not
  // know about these eleven; the discovery found them.
  'src/components/theme/ThemeSwitcher.tsx': 'Never adopted the pattern',
  'src/components/privacy/PrivacyActions.tsx': 'Never adopted the pattern',
  'src/components/privacy/CookieActions.tsx': 'Never adopted the pattern',
  'src/components/navigation/FontSizeControl.tsx': 'Never adopted the pattern',
  'src/components/molecular/DisqusComments.tsx': 'Never adopted the pattern',
  'src/components/forms/ValidatedInput.tsx': 'Never adopted the pattern',
  'src/components/forms/FormField.tsx': 'Never adopted the pattern',
  'src/components/forms/FormError.tsx': 'Never adopted the pattern',
  'src/components/calendar/CalendarConsent.tsx': 'Never adopted the pattern',
  'src/components/calendar/providers/CalendlyProvider.tsx':
    'Never adopted the pattern',
  'src/components/calendar/providers/CalComProvider.tsx':
    'Never adopted the pattern',
};

/**
 * Required files for each component
 */
const REQUIRED_FILES = {
  index: 'index.tsx',
  component: (name) => `${name}.tsx`,
  test: (name) => `${name}.test.tsx`,
  story: (name) => `${name}.stories.tsx`,
  accessibility: (name) => `${name}.accessibility.test.tsx`,
};

/**
 * Main audit function
 * @param {Object} options - Audit options
 * @param {string} options.path - Path to components directory
 * @param {string} options.format - Output format (json, markdown, console)
 * @param {boolean} options.includeIgnored - Include ignored components
 * @param {boolean} options.verbose - Verbose output
 * @param {string} options.output - Output file path
 * @param {Array} options.ignore - Patterns to ignore
 * @returns {Object} Audit report
 */
function auditComponents(options = {}) {
  const {
    path: componentsPath = 'src/components',
    format = 'console',
    includeIgnored = false,
    verbose = false,
    output = null,
    ignore = ['__tests__', '__mocks__', '*.test.js', '*.spec.js'],
  } = options;

  // Initialize report
  const report = {
    timestamp: new Date().toISOString(),
    path: componentsPath,
    summary: {
      total: 0,
      compliant: 0,
      nonCompliant: 0,
      complianceRate: 0,
      missingFiles: {
        index: 0,
        test: 0,
        story: 0,
        component: 0,
        accessibility: 0,
      },
    },
    compliant: [],
    nonCompliant: [],
    knownBare: [],
    newBare: [],
    components: [],
  };
  report.summary.knownBare = 0;
  report.summary.newBare = 0;

  // Check if path exists
  if (!fs.existsSync(componentsPath)) {
    report.error = `Path does not exist: ${componentsPath}`;
    return report;
  }

  // Find all component directories
  const componentDirs = findComponentDirectories(componentsPath, ignore);

  // Analyze each component
  componentDirs.forEach((dir) => {
    const componentName = path.basename(dir);
    const analysis = analyzeComponent(dir, componentName);

    report.components.push(analysis);
    report.summary.total++;

    if (analysis.status === 'compliant') {
      report.summary.compliant++;
      report.compliant.push(componentName);
    } else {
      report.summary.nonCompliant++;
      report.nonCompliant.push({
        name: componentName,
        path: dir,
        missing: analysis.missing,
        fixable: true,
        priority: analysis.missing.length,
      });

      // Count missing files
      analysis.missing.forEach((file) => {
        if (file === 'index.tsx') report.summary.missingFiles.index++;
        else if (file.endsWith('.accessibility.test.tsx'))
          report.summary.missingFiles.accessibility++;
        else if (file.endsWith('.test.tsx')) report.summary.missingFiles.test++;
        else if (file.endsWith('.stories.tsx'))
          report.summary.missingFiles.story++;
        else if (file.endsWith('.tsx') && !file.includes('.'))
          report.summary.missingFiles.component++;
      });
    }
  });

  // Bare `<Name>.tsx` components (#538). These are counted in `total` AND in
  // `nonCompliant` on purpose: excluding them from the denominator would leave
  // the rate at 100% and hide the very thing this discovery exists to surface.
  findBareComponentFiles(componentsPath, ignore, componentDirs).forEach(
    (file) => {
      const componentName = path.basename(file, '.tsx');
      const analysis = analyzeBareComponent(file, componentName);

      report.components.push(analysis);
      report.summary.total++;
      report.summary.nonCompliant++;
      report.nonCompliant.push({
        name: componentName,
        path: file,
        missing: analysis.missing,
        fixable: true,
        priority: analysis.missing.length,
        bareFile: true,
        known: analysis.known,
      });

      if (analysis.known) {
        report.summary.knownBare++;
        report.knownBare.push({
          name: componentName,
          path: file,
          note: analysis.bareNote,
        });
      } else {
        report.summary.newBare++;
        report.newBare.push({ name: componentName, path: file });
      }
    }
  );

  // Calculate compliance rate
  if (report.summary.total > 0) {
    report.summary.complianceRate = Math.round(
      (report.summary.compliant / report.summary.total) * 100
    );
  }

  // Format and output report
  if (format === 'console') {
    outputConsoleReport(report);
  } else if (format === 'markdown') {
    return formatMarkdownReport(report);
  }

  // Save to file if requested
  if (output) {
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    if (verbose) {
      console.log(`Report saved to: ${output}`);
    }
  }

  return report;
}

/**
 * Find all component directories
 */
function findComponentDirectories(basePath, ignorePatterns) {
  const dirs = [];
  const pattern = path.join(basePath, '**/*');

  // Get all directories
  const allDirs = glob
    .sync(pattern, {
      ignore: ignorePatterns.map((p) => path.join(basePath, '**', p)),
      nodir: false,
    })
    .filter((p) => fs.statSync(p).isDirectory());

  // Filter to component directories (contain at least one .tsx file)
  allDirs.forEach((dir) => {
    const files = fs.readdirSync(dir);
    const hasTsxFile = files.some((f) => f.endsWith('.tsx'));
    const isComponentDir = hasTsxFile && !path.basename(dir).startsWith('_');

    if (isComponentDir) {
      // Check if this is the component root (not a subdirectory)
      const componentName = path.basename(dir);
      const hasComponentFile = files.includes(`${componentName}.tsx`);
      if (hasComponentFile || files.includes('index.tsx')) {
        dirs.push(dir);
      }
    }
  });

  return dirs;
}

/**
 * Find components that are a bare `<Name>.tsx` file rather than a directory (#538).
 *
 * `findComponentDirectories` filters its glob to `isDirectory()`, which is why
 * these could never be reported: not being enumerated is not the same as
 * passing, but it reads identically in the summary.
 *
 * A `.tsx` is bare when it is a component root that does NOT sit inside the
 * directory named after it. `Button/Button.tsx` has a parent named `Button`, so
 * it belongs to a component directory already counted. `components/Footer.tsx`
 * has a parent named `components`, so nothing has counted it.
 */
function findBareComponentFiles(basePath, ignorePatterns, componentDirs = []) {
  const known = new Set(componentDirs.map((d) => path.resolve(d)));

  return glob
    .sync(path.join(basePath, '**/*.tsx'), {
      ignore: ignorePatterns.map((p) => path.join(basePath, '**', p, '**')),
      nodir: true,
    })
    .filter((file) => {
      const base = path.basename(file, '.tsx');

      // `index.tsx` is a barrel, and `X.test`/`X.stories`/`X.accessibility.test`
      // are a component's own satellites — none of them is a component root.
      if (base === 'index' || base.includes('.')) return false;

      // An internal of an already-counted component is NOT a second component.
      // SpinningLogo/ScriptHammerLogo.tsx and MapContainer/MapContainerInner.tsx
      // are private parts of SpinningLogo and MapContainer, both compliant; the
      // five-file pattern has never required a suite per internal file. Without
      // this guard the discovery reports helpers as missing components, which is
      // a different wrong number rather than the right one.
      if (known.has(path.resolve(path.dirname(file)))) return false;

      // The load-bearing test: is this file inside the directory named for it?
      return path.basename(path.dirname(file)) !== base;
    });
}

/**
 * Analyze a bare `<Name>.tsx` component (#538).
 *
 * It cannot reuse `analyzeComponent`: that starts with
 * `readdirSync(componentPath)` and a bare component has no directory of its
 * own. Everything the pattern requires except the component file itself is
 * missing by definition.
 */
function analyzeBareComponent(filePath, componentName) {
  // Keyed by PATH, not name: two `FormField.tsx` in different directories are
  // two different components, and a name-keyed baseline would silently pardon
  // the second one.
  //
  // Anchored to THIS FILE's location, never process.cwd(). Keying off the cwd
  // meant the baseline only matched when the validator ran from the repo root:
  //
  //   cwd=/app          -> 'src/components/Footer.tsx'      matches
  //   cwd=/app/src      -> 'components/Footer.tsx'          misses
  //   cwd=/app/scripts  -> '../src/components/Footer.tsx'   misses
  //
  // A miss makes every recorded component read as NEW, so the gate fails with
  // "17 NEW bare components" — which is false, and says nothing about the cwd
  // that caused it. It failed closed rather than open, which is the safer
  // direction, but a gate whose job is telling the truth should not lie about
  // which components are new.
  const key = path
    .relative(REPO_ROOT, path.resolve(filePath))
    .split(path.sep)
    .join('/');
  const note = KNOWN_BARE_COMPONENTS[key];

  return {
    name: componentName,
    path: filePath,
    category: detectCategory(filePath),
    isBareFile: true,
    files: {
      component: { exists: true, path: filePath, valid: true, errors: [] },
      index: { exists: false, path: null, valid: false, errors: [] },
      test: { exists: false, path: null, valid: false, errors: [] },
      story: { exists: false, path: null, valid: false, errors: [] },
      accessibility: { exists: false, path: null, valid: false, errors: [] },
    },
    status: 'non_compliant',
    known: Boolean(note),
    bareNote: note || null,
    missing: [
      REQUIRED_FILES.index,
      REQUIRED_FILES.test(componentName),
      REQUIRED_FILES.story(componentName),
      REQUIRED_FILES.accessibility(componentName),
    ],
  };
}

/**
 * Analyze a single component directory
 */
function analyzeComponent(componentPath, componentName) {
  const files = fs.readdirSync(componentPath);
  const missing = [];

  const analysis = {
    name: componentName,
    path: componentPath,
    category: detectCategory(componentPath),
    files: {},
    status: 'compliant',
    missing: [],
  };

  // Check for required files
  const requiredFiles = {
    index: REQUIRED_FILES.index,
    component: REQUIRED_FILES.component(componentName),
    test: REQUIRED_FILES.test(componentName),
    story: REQUIRED_FILES.story(componentName),
    accessibility: REQUIRED_FILES.accessibility(componentName),
  };

  Object.entries(requiredFiles).forEach(([key, fileName]) => {
    const filePath = path.join(componentPath, fileName);
    const exists = fs.existsSync(filePath);

    analysis.files[key] = {
      exists,
      path: filePath,
      valid: exists ? validateFile(filePath, key) : false,
      errors: exists ? [] : [`File not found: ${fileName}`],
    };

    if (!exists) {
      missing.push(fileName);
    }
  });

  if (missing.length > 0) {
    analysis.status = 'non_compliant';
    analysis.missing = missing;
  }

  return analysis;
}

/**
 * Detect component category from path
 */
function detectCategory(componentPath) {
  if (componentPath.includes('subatomic')) return 'subatomic';
  if (componentPath.includes('atomic')) return 'atomic';
  if (componentPath.includes('molecular')) return 'molecular';
  if (componentPath.includes('organisms')) return 'organisms';
  if (componentPath.includes('templates')) return 'templates';
  return 'unknown';
}

/**
 * Validate file content
 */
function validateFile(filePath, type) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    switch (type) {
      case 'index':
        return validateIndexFile(content);
      case 'test':
        return validateTestFile(content);
      case 'story':
        return validateStoryFile(content);
      case 'accessibility':
        return validateAccessibilityFile(content);
      default:
        return true;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Validate index.tsx content
 */
function validateIndexFile(content) {
  return (
    content.includes('export { default }') || content.includes('export default')
  );
}

/**
 * Validate test file content
 */
function validateTestFile(content) {
  // `includes('test')` without the paren matches the word "test" anywhere —
  // including comments like `// no tests`. That's how a placeholder stub with
  // zero actual tests was passing validation. The paren is load-bearing: it
  // distinguishes `test(...)` calls from prose containing the word.
  return (
    content.includes('describe') ||
    content.includes('test(') ||
    content.includes('it(')
  );
}

/**
 * Validate story file content
 */
function validateStoryFile(content) {
  return (
    content.includes('export default') &&
    (content.includes('title:') || content.includes('title'))
  );
}

/**
 * Validate accessibility test file content
 */
function validateAccessibilityFile(content) {
  return (
    (content.includes('jest-axe') ||
      content.includes('axe') ||
      content.includes('toHaveNoViolations')) &&
    (content.includes('describe') ||
      content.includes('test') ||
      content.includes('it('))
  );
}

/**
 * Output console report
 */
function outputConsoleReport(report) {
  console.log('\n📊 Component Structure Audit Report');
  console.log('='.repeat(50));
  console.log(`✅ Compliant: ${report.summary.compliant} components`);
  console.log(`❌ Non-compliant: ${report.summary.nonCompliant} components`);
  console.log(
    `   of which bare files: ${report.summary.knownBare} recorded, ${report.summary.newBare} NEW`
  );
  console.log(`📈 Compliance Rate: ${report.summary.complianceRate}%`);

  // Printed EVERY run, with a note each — the same rule the contrast gate
  // follows. A baseline nobody sees is indistinguishable from a pass (#396).
  if (report.knownBare.length > 0) {
    console.log(
      '\n📋 Recorded bare components (#538) — counted against the rate above, tracked in #547.'
    );
    console.log('   This list may shrink and must never grow.\n');
    report.knownBare.forEach((comp) => {
      console.log(`  ${comp.path} — ${comp.note}`);
    });
  }

  if (report.newBare.length > 0) {
    console.log(
      '\n🚨 NEW bare components — not in the recorded baseline. Give them the 5-file pattern;'
    );
    console.log(
      '   do NOT add them to KNOWN_BARE_COMPONENTS to make this pass (#396).\n'
    );
    report.newBare.forEach((comp) => console.log(`  ${comp.path}`));
  }

  if (report.nonCompliant.length > 0) {
    console.log('\n⚠️  Non-compliant Components:\n');
    report.nonCompliant.forEach((comp) => {
      console.log(`  ${comp.name}:`);
      console.log(`    Path: ${comp.path}`);
      console.log(`    Missing: ${comp.missing.join(', ')}`);
    });
  }

  console.log('\n📄 Run with --format json for detailed report\n');
}

/**
 * Format markdown report
 */
function formatMarkdownReport(report) {
  let md = '# Component Structure Audit Report\n\n';
  md += `**Date**: ${report.timestamp}\n`;
  md += `**Path**: ${report.path}\n\n`;
  md += '## Summary\n\n';
  md += `- Total Components: ${report.summary.total}\n`;
  md += `- Compliant: ${report.summary.compliant}\n`;
  md += `- Non-compliant: ${report.summary.nonCompliant}\n`;
  md += `- Compliance Rate: ${report.summary.complianceRate}%\n\n`;

  if (report.nonCompliant.length > 0) {
    md += '## Non-compliant Components\n\n';
    report.nonCompliant.forEach((comp) => {
      md += `### ${comp.name}\n`;
      md += `- Path: \`${comp.path}\`\n`;
      md += `- Missing Files:\n`;
      comp.missing.forEach((file) => {
        md += `  - ${file}\n`;
      });
      md += '\n';
    });
  }

  return md;
}

// Export for testing
module.exports = auditComponents;
module.exports.validateIndexFile = validateIndexFile;
module.exports.validateTestFile = validateTestFile;
module.exports.validateStoryFile = validateStoryFile;
module.exports.validateAccessibilityFile = validateAccessibilityFile;
module.exports.findBareComponentFiles = findBareComponentFiles;
module.exports.analyzeBareComponent = analyzeBareComponent;
module.exports.KNOWN_BARE_COMPONENTS = KNOWN_BARE_COMPONENTS;

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse --format argument
  let format = 'console';
  const formatIndex = args.indexOf('--format');
  if (formatIndex !== -1 && args[formatIndex + 1]) {
    format = args[formatIndex + 1];
  } else if (args.includes('--json')) {
    format = 'json';
  } else if (args.includes('--markdown')) {
    format = 'markdown';
  }

  // Parse --path argument
  let path = 'src/components';
  const pathIndex = args.indexOf('--path');
  if (pathIndex !== -1 && args[pathIndex + 1]) {
    path = args[pathIndex + 1];
  } else {
    // Legacy: first non-flag argument as path
    const nonFlagArg = args.find((a) => !a.startsWith('--'));
    if (nonFlagArg) path = nonFlagArg;
  }

  const options = {
    path: path,
    format: format,
    verbose: args.includes('--verbose'),
    output: args.find((a) => a.startsWith('--output='))?.split('=')[1],
  };

  const result = auditComponents(options);

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  }
}
