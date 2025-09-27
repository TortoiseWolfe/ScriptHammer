import type { NextConfig } from 'next';
import { execSync } from 'child_process';

// Run project detection at build time
function detectProjectConfig() {
  try {
    // Run the detection script to generate config files
    execSync('node scripts/detect-project.js', { stdio: 'inherit' });
  } catch {
    console.warn('Could not run detection script');
  }

  // Use environment variable if set (from .env.local or CI/CD)
  if (process.env.NEXT_PUBLIC_BASE_PATH !== undefined) {
    return process.env.NEXT_PUBLIC_BASE_PATH;
  }

  // Read the auto-detected configuration using require
  try {
    const fs = require('fs');

    const path = require('path');
    const configPath = path.join(
      __dirname,
      'src',
      'config',
      'project-detected.json'
    );
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.basePath || '';
  } catch {
    // Final fallback if detection completely fails
    console.warn('Could not read detected config, using empty base path');
    return '';
  }
}

const basePath = detectProjectConfig();

const nextConfig: NextConfig = {
  output: 'export',
  basePath: basePath,
  assetPrefix: basePath ? `${basePath}/` : '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  cleanDistDir: true,
};

export default nextConfig;
