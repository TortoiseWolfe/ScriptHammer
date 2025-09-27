#!/usr/bin/env node

/**
 * Generate deployment history from git commits
 *
 * NOTE: This is now MANUAL ONLY - no longer runs automatically during builds
 * The deployment-history.json file is manually maintained for major milestones only
 *
 * To regenerate from git history: node scripts/generate-deployment-history.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get the last 30 commits with their dates and messages
function getGitHistory() {
  try {
    const gitLog = execSync(
      'git log --pretty=format:"%ad|%s" --date=short -30',
      { encoding: 'utf-8' }
    );

    const commits = gitLog.split('\n').filter((line) => line.trim());

    return commits.map((line) => {
      const [date, ...messageParts] = line.split('|');
      const message = messageParts.join('|');

      // Convert date format from YYYY-MM-DD to M/D/YYYY
      const [year, month, day] = date.split('-');
      const formattedDate = `${parseInt(month)}/${parseInt(day)}/${year}`;

      // Extract feature name from commit message
      let feature = message;

      // Remove conventional commit prefixes
      feature = feature.replace(
        /^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+?\))?:\s*/i,
        ''
      );

      // Capitalize first letter
      feature = feature.charAt(0).toUpperCase() + feature.slice(1);

      // Truncate if too long
      if (feature.length > 50) {
        feature = feature.substring(0, 47) + '...';
      }

      return {
        date: formattedDate,
        feature: feature,
        status: 'success',
      };
    });
  } catch (error) {
    console.error('Error reading git history:', error.message);
    return [];
  }
}

// Main function
function generateDeploymentHistory() {
  const deployments = getGitHistory();

  // Add some key milestones if not in recent history
  const milestones = [
    {
      date: '9/12/2025',
      feature: 'Captain Ship & Crew Game',
      status: 'success',
    },
    { date: '9/11/2025', feature: 'Testing Infrastructure', status: 'success' },
    { date: '9/11/2025', feature: 'Code Formatting Setup', status: 'success' },
    { date: '9/10/2025', feature: 'Storybook Integration', status: 'success' },
    { date: '9/10/2025', feature: 'Next.js 15.5 Setup', status: 'success' },
    { date: '9/9/2025', feature: 'Initial Setup', status: 'success' },
  ];

  // Merge and deduplicate
  const allDeployments = [...deployments];

  // Add milestones that aren't already in the list
  milestones.forEach((milestone) => {
    const exists = allDeployments.some((d) =>
      d.feature
        .toLowerCase()
        .includes(milestone.feature.toLowerCase().substring(0, 10))
    );
    if (!exists) {
      allDeployments.push(milestone);
    }
  });

  // Sort by date (newest first)
  allDeployments.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });

  // Limit to 20 most recent
  const finalDeployments = allDeployments.slice(0, 20);

  // Write to JSON file
  const outputPath = path.join(
    __dirname,
    '..',
    'src',
    'data',
    'deployment-history.json'
  );
  const outputDir = path.dirname(outputPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify(finalDeployments, null, 2) + '\n'
  );

  console.log(
    `✅ Generated deployment history with ${finalDeployments.length} entries`
  );
  console.log(`📁 Saved to: ${outputPath}`);
}

// Run if called directly
if (require.main === module) {
  generateDeploymentHistory();
}

module.exports = generateDeploymentHistory;
