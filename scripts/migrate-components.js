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

  component.missing.forEach((file) => {
    const filePath = path.join(component.path, file);
    const content = generateFileContent(file, component.name, component.path);

    fs.writeFileSync(filePath, content);
    created.push(filePath);
  });

  return created;
}

/**
 * Generate content for missing file
 */
function generateFileContent(fileName, componentName, componentPath) {
  if (fileName === 'index.tsx') {
    return getIndexTemplate(componentName);
  } else if (fileName.endsWith('.accessibility.test.tsx')) {
    return getAccessibilityTestTemplate(componentName);
  } else if (fileName.endsWith('.test.tsx')) {
    return getTestTemplate(componentName);
  } else if (fileName.endsWith('.stories.tsx')) {
    const category = detectCategory(componentPath);
    return getStoryTemplate(componentName, category);
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
function getIndexTemplate(componentName) {
  return `export { default } from './${componentName}';
export type { ${componentName}Props } from './${componentName}';
`;
}

/**
 * Template for test file
 */
function getTestTemplate(componentName) {
  return `import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ${componentName} from './${componentName}';

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
function getStoryTemplate(componentName, category) {
  return `import type { Meta, StoryObj } from '@storybook/react';
import ${componentName} from './${componentName}';

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
function getAccessibilityTestTemplate(componentName) {
  return `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ${componentName} } from './${componentName}';

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
