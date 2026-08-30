#!/usr/bin/env node

/**
 * Component Structure Migration Tool
 * Automatically creates missing files to achieve 4-file pattern compliance
 */

'use strict';

const fs = require('fs');
const path = require('path');
const auditComponents = require('./audit-components');

/**
 * Main migration function
 * @param {Object} options - Migration options
 * @param {string} options.path - Path to components directory
 * @param {boolean} options.dryRun - Preview changes without applying
 * @param {boolean} options.backup - Create backup before migration
 * @param {Array} options.components - Specific components to migrate
 * @param {boolean} options.continueOnError - Continue if migration fails
 * @param {boolean} options.verbose - Verbose output
 * @param {string} options.output - Output report file path
 * @returns {Object} Migration result
 */
function migrateComponents(options = {}) {
  const {
    path: componentsPath = 'src/components',
    dryRun = false,
    backup = true,
    components = [],
    continueOnError = false,
    verbose = false,
    output = null,
  } = options;

  // Initialize result
  const result = {
    timestamp: new Date().toISOString(),
    success: true,
    migrated: 0,
    failed: 0,
    skipped: 0,
    planned: [],
    toMigrate: [],
    details: [],
    backupPath: null,
    report: {
      migrated: 0,
      failed: 0,
      skipped: 0,
    },
  };

  // Run audit to find non-compliant components
  const audit = auditComponents({ path: componentsPath, format: 'json' });

  if (audit.error) {
    result.success = false;
    result.error = audit.error;
    return result;
  }

  // Filter components to migrate
  const componentsToMigrate =
    components.length > 0
      ? audit.nonCompliant.filter((c) => components.includes(c.name))
      : audit.nonCompliant;

  result.toMigrate = componentsToMigrate;

  if (componentsToMigrate.length === 0) {
    if (verbose) {
      console.log('✅ All components are already compliant!');
    }
    return result;
  }

  // Create backup if requested
  if (backup && !dryRun) {
    result.backupPath = createBackup(componentsPath);
    if (verbose) {
      console.log(`📦 Backup created at: ${result.backupPath}`);
    }
  }

  // Process each component
  if (!dryRun) {
    console.log('\n🔄 Starting Component Migration\n');
  }

  componentsToMigrate.forEach((component) => {
    if (verbose || !dryRun) {
      console.log(`\n  Migrating ${component.name}...`);
    }

    const migrationDetail = {
      component: component.name,
      status: 'pending',
      filesCreated: [],
      error: null,
    };

    try {
      // Plan or execute migration
      if (dryRun) {
        const planned = planMigration(component);
        result.planned.push(...planned);
        migrationDetail.status = 'planned';
        migrationDetail.filesCreated = planned.map((p) => p.file);
      } else {
        const created = executeMigration(component);
        migrationDetail.filesCreated = created;
        migrationDetail.status = 'success';
        result.migrated++;

        created.forEach((file) => {
          console.log(`    ✅ Created ${path.basename(file)}`);
        });
      }
    } catch (error) {
      migrationDetail.status = 'failed';
      migrationDetail.error = error.message;
      result.failed++;

      if (verbose) {
        console.error(`    ❌ Failed: ${error.message}`);
      }

      if (!continueOnError) {
        result.success = false;
        result.error = error.message;
        return result;
      }
    }

    result.details.push(migrationDetail);
  });

  // Update report counts
  result.report.migrated = result.migrated;
  result.report.failed = result.failed;
  result.report.skipped = result.skipped;

  // Output summary
  if (!dryRun) {
    console.log(
      `\n✅ Migration complete! ${result.migrated} components updated.\n`
    );
  } else {
    console.log(
      `\n📋 Dry run complete. ${result.planned.length} files would be created.\n`
    );
  }

  // Save report if requested
  if (output) {
    const report = {
      ...result,
      components: componentsToMigrate.map((c) => c.name),
      filesCreated: result.details.flatMap((d) => d.filesCreated),
    };
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    if (verbose) {
      console.log(`📄 Report saved to: ${output}`);
    }
  }

  return result;
}

/**
 * Plan migration for a component (dry run)
 */
function planMigration(component) {
  const planned = [];

  component.missing.forEach((file) => {
    planned.push({
      action: 'create',
      component: component.name,
      file: path.join(component.path, file),
      template: getTemplateType(file),
    });
  });

  return planned;
}

/**
 * Execute migration for a component
 */
function executeMigration(component) {
  const created = [];

  // A BARE COMPONENT'S `path` IS A FILE, not a directory (#1017).
  //
  // This used to `path.join(component.path, file)` unconditionally, so for
  // `src/components/Foo.tsx` it attempted `src/components/Foo.tsx/index.tsx` and
  // died with ENOTDIR. There was no mkdir and no move anywhere in the script —
  // meaning the one command CI tells people to run could not fix the one thing
  // CI fails them for. All twenty components migrated for #547 were moved by hand.
  let dir = component.path;
  if (component.bareFile) {
    dir = path.join(
      path.dirname(component.path),
      path.basename(component.path, '.tsx')
    );
    fs.mkdirSync(dir, { recursive: true });
    const moved = path.join(dir, path.basename(component.path));
    fs.renameSync(component.path, moved);
    created.push(`${component.path} -> ${moved}`);
  }

  // Read the exports from the component's real source, wherever it now lives, so
  // the barrel and the generated imports match it. Ten of #547's seventeen had no
  // default export, and the templates assumed one.
  const sourcePath = component.bareFile
    ? path.join(dir, path.basename(component.path))
    : path.join(dir, `${component.name}.tsx`);
  const exports = detectExports(sourcePath, component.name);

  component.missing.forEach((file) => {
    const filePath = path.join(dir, file);
    const content = generateFileContent(file, component.name, dir, exports);

    fs.writeFileSync(filePath, content);
    created.push(filePath);
  });

  return created;
}

/**
 * How a component actually exposes itself, read from its source.
 *
 * The templates used to assume `export default` unconditionally while the
 * accessibility template imported `{ Name }` — so for any given component one of
 * the two was wrong, and it produced files that did not compile. Ten of the
 * seventeen components migrated for #547 had no default export at all (#1017).
 *
 * Returns { hasDefault, hasNamed, hasPropsType }.
 */
function detectExports(sourcePath, componentName) {
  let src = '';
  try {
    src = fs.readFileSync(sourcePath, 'utf8');
  } catch {
    // Unreadable source: assume the plop default rather than guessing wrong in
    // the other direction, and let the caller's file writes surface the problem.
    return { hasDefault: true, hasNamed: false, hasPropsType: false };
  }
  // Comments stripped first: a docblock saying "export default" is not one.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const name = componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    hasDefault: /export\s+default\s/.test(code),
    hasNamed: new RegExp(
      `export\\s+(?:const|function|class)\\s+${name}\\b`
    ).test(code),
    hasPropsType: new RegExp(
      `export\\s+(?:interface|type)\\s+${name}Props\\b`
    ).test(code),
  };
}

/**
 * Generate content for missing file
 */
function generateFileContent(fileName, componentName, componentPath, exports) {
  if (fileName === 'index.tsx') {
    return getIndexTemplate(componentName, exports);
  } else if (fileName.endsWith('.accessibility.test.tsx')) {
    return getAccessibilityTestTemplate(componentName, exports);
  } else if (fileName.endsWith('.test.tsx')) {
    return getTestTemplate(componentName, exports);
  } else if (fileName.endsWith('.stories.tsx')) {
    const category = detectCategory(componentPath);
    return getStoryTemplate(componentName, category, exports);
  }
  return '';
}

/**
 * Get template type for file
 */
function getTemplateType(fileName) {
  if (fileName === 'index.tsx') return 'index';
  if (fileName.endsWith('.accessibility.test.tsx')) return 'accessibility';
  if (fileName.endsWith('.test.tsx')) return 'test';
  if (fileName.endsWith('.stories.tsx')) return 'story';
  return 'unknown';
}

/**
 * Detect component category from path
 */
function detectCategory(componentPath) {
  if (componentPath.includes('subatomic')) return 'Subatomic';
  if (componentPath.includes('atomic')) return 'Atomic';
  if (componentPath.includes('molecular')) return 'Molecular';
  if (componentPath.includes('organisms')) return 'Organisms';
  if (componentPath.includes('templates')) return 'Templates';
  return 'Components';
}

/**
 * Create backup of components directory
 */
function createBackup(componentsPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    path.dirname(componentsPath),
    `.component-backup-${timestamp}`
  );

  copyDirectory(componentsPath, backupPath);
  return backupPath;
}

/**
 * Recursively copy directory
 */
function copyDirectory(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  entries.forEach((entry) => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

/**
 * Template for index.tsx
 */
function getIndexTemplate(componentName, exports = { hasDefault: true }) {
  const lines = [];
  if (exports.hasDefault) {
    lines.push(`export { default } from './${componentName}';`);
  }
  if (exports.hasNamed) {
    lines.push(`export { ${componentName} } from './${componentName}';`);
  }
  // Neither detected: fall back to the default form rather than emitting an empty
  // barrel, which would fail confusingly at the import site instead of here.
  if (lines.length === 0) {
    lines.push(`export { default } from './${componentName}';`);
  }
  if (exports.hasPropsType) {
    lines.push(
      `export type { ${componentName}Props } from './${componentName}';`
    );
  }
  return lines.join('\n') + '\n';
}

/** The import a generated test or story should use, matching the real export. */
function importLine(componentName, exports = { hasDefault: true }) {
  return exports.hasDefault
    ? `import ${componentName} from './${componentName}';`
    : `import { ${componentName} } from './${componentName}';`;
}

/**
 * Template for test file
 */
function getTestTemplate(componentName, exports) {
  return `import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
${importLine(componentName, exports)}

describe('${componentName}', () => {
  it('renders without crashing', () => {
    render(<${componentName} />);
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });

  // TODO: Add more specific tests
});
`;
}

/**
 * Template for story file
 */
function getStoryTemplate(componentName, category, exports) {
  return `import type { Meta, StoryObj } from '@storybook/react';
${importLine(componentName, exports)}

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${category}/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
`;
}

/**
 * Template for accessibility test file
 */
function getAccessibilityTestTemplate(componentName, exports) {
  return `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
${importLine(componentName, exports)}

describe('${componentName} Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<${componentName} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // TODO: Add more specific accessibility tests for different component states
  // Examples:
  // - Test with different prop combinations
  // - Test keyboard navigation
  // - Test ARIA attributes
  // - Test color contrast
  // - Test focus management
});
`;
}

// Export for testing
module.exports = migrateComponents;
module.exports.getIndexTemplate = getIndexTemplate;
module.exports.getTestTemplate = getTestTemplate;
module.exports.getStoryTemplate = getStoryTemplate;
module.exports.getAccessibilityTestTemplate = getAccessibilityTestTemplate;

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    path: args.find((a) => !a.startsWith('--')) || 'src/components',
    dryRun: args.includes('--dry-run'),
    backup: !args.includes('--no-backup'),
    verbose: args.includes('--verbose'),
    output: args.find((a) => a.startsWith('--output='))?.split('=')[1],
    components:
      args
        .find((a) => a.startsWith('--components='))
        ?.split('=')[1]
        ?.split(',') || [],
  };

  migrateComponents(options);
}
