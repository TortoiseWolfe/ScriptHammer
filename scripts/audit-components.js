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
    components: [],
  };

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
  return (
    content.includes('describe') ||
    content.includes('test') ||
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
  console.log(`📈 Compliance Rate: ${report.summary.complianceRate}%`);

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
