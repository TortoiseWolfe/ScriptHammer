/**
 * Report Formatters
 * JSON and Markdown formatters for component audit reports
 */

'use strict';

/**
 * Format report as JSON
 * @param {Object} data - Report data
 * @returns {string} JSON formatted report
 */
function formatJSON(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Format report as Markdown
 * @param {Object} data - Report data
 * @returns {string} Markdown formatted report
 */
function formatMarkdown(data) {
  let md = '# Component Structure Report\n\n';

  // Metadata
  md += `**Generated**: ${data.timestamp || new Date().toISOString()}\n`;
  md += `**Path**: \`${data.path || 'src/components'}\`\n\n`;

  // Summary section
  if (data.summary) {
    md += '## Summary\n\n';
    md += '| Metric | Value |\n';
    md += '|--------|-------|\n';
    md += `| Total Components | ${data.summary.total} |\n`;
    md += `| Compliant | ${data.summary.compliant} |\n`;
    md += `| Non-Compliant | ${data.summary.nonCompliant} |\n`;
    md += `| Compliance Rate | ${data.summary.complianceRate}% |\n\n`;

    // Missing files breakdown
    if (data.summary.missingFiles) {
      md += '### Missing Files Breakdown\n\n';
      md += '| File Type | Count |\n';
      md += '|-----------|-------|\n';
      md += `| index.tsx | ${data.summary.missingFiles.index} |\n`;
      md += `| Test Files | ${data.summary.missingFiles.test} |\n`;
      md += `| Story Files | ${data.summary.missingFiles.story} |\n`;
      md += `| Component Files | ${data.summary.missingFiles.component} |\n\n`;
    }
  }

  // Compliant components
  if (data.compliant && data.compliant.length > 0) {
    md += '## ✅ Compliant Components\n\n';
    data.compliant.forEach((component) => {
      md += `- ${component}\n`;
    });
    md += '\n';
  }

  // Non-compliant components
  if (data.nonCompliant && data.nonCompliant.length > 0) {
    md += '## ❌ Non-Compliant Components\n\n';
    data.nonCompliant.forEach((comp) => {
      md += `### ${comp.name}\n\n`;
      md += `- **Path**: \`${comp.path}\`\n`;
      md += `- **Priority**: ${comp.priority || 'Normal'}\n`;
      md += `- **Missing Files**:\n`;
      comp.missing.forEach((file) => {
        md += `  - ${file}\n`;
      });
      md += '\n';
    });
  }

  // Recommendations
  md += '## Recommendations\n\n';
  if (data.summary && data.summary.nonCompliant > 0) {
    md +=
      '1. Run `pnpm run migrate:components` to automatically fix missing files\n';
    md += '2. Review generated files and add proper implementation\n';
    md += '3. Run `pnpm run validate:structure` to verify compliance\n';
  } else {
    md += '✅ All components are compliant with the 4-file structure!\n';
  }

  return md;
}

/**
 * Format report as HTML
 * @param {Object} data - Report data
 * @returns {string} HTML formatted report
 */
function formatHTML(data) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Structure Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .compliant { color: #22c55e; }
    .non-compliant { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f9f9f9; font-weight: 600; }
    .component-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .missing-files { color: #ef4444; margin-left: 20px; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #22c55e; color: white; }
    .badge-error { background: #ef4444; color: white; }
  </style>
</head>
<body>
  <h1>Component Structure Report</h1>

  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Generated:</strong> ${data.timestamp || new Date().toISOString()}</p>
    <p><strong>Path:</strong> <code>${data.path || 'src/components'}</code></p>
    <p>
      <span class="compliant">✅ Compliant: ${data.summary?.compliant || 0}</span> |
      <span class="non-compliant">❌ Non-Compliant: ${data.summary?.nonCompliant || 0}</span> |
      <strong>Total: ${data.summary?.total || 0}</strong>
    </p>
    <p><strong>Compliance Rate:</strong> ${data.summary?.complianceRate || 0}%</p>
  </div>`;

  if (data.nonCompliant && data.nonCompliant.length > 0) {
    html += '<h2>Non-Compliant Components</h2>';
    data.nonCompliant.forEach((comp) => {
      html += `
      <div class="component-card">
        <h3>${comp.name} <span class="badge badge-error">Non-Compliant</span></h3>
        <p><strong>Path:</strong> <code>${comp.path}</code></p>
        <p><strong>Missing Files:</strong></p>
        <ul class="missing-files">
          ${comp.missing.map((file) => `<li>${file}</li>`).join('')}
        </ul>
      </div>`;
    });
  }

  if (data.compliant && data.compliant.length > 0) {
    html += '<h2>Compliant Components</h2>';
    html += '<ul>';
    data.compliant.forEach((component) => {
      html += `<li>${component} <span class="badge badge-success">✓</span></li>`;
    });
    html += '</ul>';
  }

  html += `
</body>
</html>`;

  return html;
}

/**
 * Format report based on type
 * @param {Object} data - Report data
 * @param {string} format - Format type (json, markdown, html)
 * @returns {string} Formatted report
 */
function format(data, format = 'json') {
  switch (format.toLowerCase()) {
    case 'json':
      return formatJSON(data);
    case 'markdown':
    case 'md':
      return formatMarkdown(data);
    case 'html':
      return formatHTML(data);
    default:
      return formatJSON(data);
  }
}

module.exports = {
  format,
  formatJSON,
  formatMarkdown,
  formatHTML,
};
