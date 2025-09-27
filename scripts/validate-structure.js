#!/usr/bin/env node

/**
 * Component Structure Validation Tool
 * CI-ready validation with proper exit codes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const auditComponents = require('./audit-components');

/**
 * Main validation function
 * @param {Object} options - Validation options
 * @param {string} options.path - Path to components directory
 * @param {boolean} options.failFast - Stop on first error
 * @param {boolean} options.strict - Enforce all rules including warnings
 * @param {string} options.format - Output format (json, console)
 * @param {string} options.filter - Filter components by pattern
 * @returns {Object} Validation report
 */
function validateStructure(options = {}) {
  const {
    path: componentsPath = 'src/components',
    failFast = false,
    strict = false,
    format = 'console',
    filter = null,
  } = options;

  // Initialize report
  const report = {
    timestamp: new Date().toISOString(),
    valid: true,
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
    warnings: [],
    exitCode: 0,
    report: {
      total: 0,
      passed: 0,
      failed: 0,
    },
  };

  // Run audit
  const audit = auditComponents({ path: componentsPath, format: 'json' });

  if (audit.error) {
    report.valid = false;
    report.exitCode = 1;
    report.errors.push({
      component: 'N/A',
      rule: 'path-exists',
      message: audit.error,
    });
    outputReport(report, format);
    return report;
  }

  // Filter components if requested
  let componentsToValidate = audit.components;
  if (filter) {
    const filterRegex = new RegExp(filter);
    componentsToValidate = componentsToValidate.filter((c) =>
      filterRegex.test(c.name)
    );
  }

  report.total = componentsToValidate.length;
  report.report.total = report.total;

  // Validate each component
  for (const component of componentsToValidate) {
    const validation = validateComponent(component, strict);

    if (validation.valid) {
      report.passed++;
    } else {
      report.failed++;
      report.valid = false;

      // Add errors
      validation.errors.forEach((error) => {
        report.errors.push({
          component: component.name,
          rule: error.rule,
          message: error.message,
          file: error.file,
          missing: component.missing,
        });
      });

      // Stop if fail-fast is enabled
      if (failFast) {
        break;
      }
    }

    // Add warnings in strict mode
    if (strict && validation.warnings.length > 0) {
      report.valid = false;
      validation.warnings.forEach((warning) => {
        report.warnings.push({
          component: component.name,
          rule: warning.rule,
          message: warning.message,
          suggestion: warning.suggestion,
        });
      });
    }
  }

  // Update report counts
  report.report.passed = report.passed;
  report.report.failed = report.failed;

  // Set exit code
  report.exitCode = report.valid ? 0 : 1;

  // Output report
  outputReport(report, format);

  return report;
}

/**
 * Validate a single component
 */
function validateComponent(component, strict) {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check for missing files (errors)
  if (component.status === 'non_compliant') {
    validation.valid = false;

    if (component.missing && component.missing.length > 0) {
      component.missing.forEach((file) => {
        validation.errors.push({
          rule: 'required-file',
          file: file,
          message: `Missing required file: ${file}`,
        });
      });
    }
  }

  // Check file naming conventions
  const files = fs.readdirSync(component.path);
  files.forEach((file) => {
    if (!validateFileName(file, component.name)) {
      validation.valid = false;
      validation.errors.push({
        rule: 'naming-convention',
        file: file,
        message: `File naming convention error: ${file}`,
        reason: 'naming',
      });
    }
  });

  // Check file content (warnings in non-strict, errors in strict)
  Object.entries(component.files || {}).forEach(([type, fileInfo]) => {
    if (fileInfo.exists && !fileInfo.valid) {
      const issue = {
        rule: 'content-validation',
        file: path.basename(fileInfo.path),
        message: `Invalid content in ${type} file`,
      };

      if (strict) {
        validation.valid = false;
        validation.errors.push(issue);
      } else {
        validation.warnings.push({
          ...issue,
          suggestion: `Update ${type} file to meet requirements`,
        });
      }
    }
  });

  return validation;
}

/**
 * Validate file naming convention
 */
function validateFileName(fileName, componentName) {
  // index.tsx is always valid
  if (fileName === 'index.tsx') return true;

  // Component file should match component name
  if (fileName === `${componentName}.tsx`) return true;

  // Test file should be .test.tsx, not .spec.tsx
  if (fileName === `${componentName}.test.tsx`) return true;

  // Accessibility test file should be .accessibility.test.tsx
  if (fileName === `${componentName}.accessibility.test.tsx`) return true;

  // Story file should be .stories.tsx, not .story.tsx
  if (fileName === `${componentName}.stories.tsx`) return true;

  // Other TypeScript files might be helpers
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
    // Check for common mistakes
    if (fileName === `${componentName.toLowerCase()}.tsx`) return false; // Wrong case
    if (fileName === `${componentName}.spec.tsx`) return false; // Should be .test.tsx
    if (fileName === `${componentName}.story.tsx`) return false; // Should be .stories.tsx
    if (fileName === `${componentName}.a11y.test.tsx`) return false; // Should be .accessibility.test.tsx
  }

  return true; // Allow other files
}

/**
 * Validate file content requirements
 */
function validateContent(content, type) {
  const validation = { valid: true, errors: [] };

  switch (type) {
    case 'index':
      if (
        !content.includes('export { default }') &&
        !content.includes('export default')
      ) {
        validation.valid = false;
        validation.errors.push('Missing default export');
      }
      break;

    case 'component':
      if (!content.includes('export default')) {
        validation.valid = false;
        validation.errors.push('Missing default export');
      }
      break;

    case 'test':
      if (
        !content.includes('describe') &&
        !content.includes('test') &&
        !content.includes('it(')
      ) {
        validation.valid = false;
        validation.errors.push('No test cases found');
      }
      break;

    case 'story':
      if (!content.includes('export default')) {
        validation.valid = false;
        validation.errors.push('Missing default export (Meta)');
      }
      if (!content.includes('export const')) {
        validation.valid = false;
        validation.errors.push('No stories exported');
      }
      break;
  }

  return validation;
}

/**
 * Output validation report
 */
function outputReport(report, format) {
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Console output
  if (report.valid) {
    console.log(
      '\n✅ All components follow the 5-file pattern (with accessibility tests)!\n'
    );
    console.log(
      `Total: ${report.total} | Passed: ${report.passed} | Failed: ${report.failed}`
    );
  } else {
    console.error('\n❌ Component structure validation failed!\n');
    console.error(
      `Total: ${report.total} | Passed: ${report.passed} | Failed: ${report.failed}`
    );

    if (report.errors.length > 0) {
      console.error('\nErrors:');
      report.errors.forEach((error) => {
        console.error(`  - ${error.component}: ${error.message}`);
        if (error.missing && error.missing.length > 0) {
          console.error(`    Missing: ${error.missing.join(', ')}`);
        }
      });
    }

    if (report.warnings.length > 0) {
      console.warn('\nWarnings:');
      report.warnings.forEach((warning) => {
        console.warn(`  - ${warning.component}: ${warning.message}`);
        if (warning.suggestion) {
          console.warn(`    Suggestion: ${warning.suggestion}`);
        }
      });
    }

    console.error('\nRun "pnpm run migrate:components" to fix.\n');
  }
}

// Export for testing
module.exports = validateStructure;
module.exports.validateContent = validateContent;

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    path: args.find((a) => !a.startsWith('--')) || 'src/components',
    failFast: args.includes('--fail-fast'),
    strict: args.includes('--strict'),
    format: args.includes('--json') ? 'json' : 'console',
    filter: args.find((a) => a.startsWith('--filter='))?.split('=')[1],
  };

  const result = validateStructure(options);
  process.exit(result.exitCode);
}
