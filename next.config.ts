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
  // Treat empty string as undefined to allow auto-detection in forks
  const envBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  if (envBasePath !== undefined && envBasePath !== '') {
    return envBasePath;
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
  // Overridable so production builds can run WHILE the dev server owns .next —
  // `next dev` and `next build` sharing one distDir race during "Collecting
  // page data" (spurious PageNotFoundError). scripts/e2e-live-acceptance.sh
  // sets NEXT_DIST_DIR=.next-acceptance/build for exactly this reason (a
  // subdir of a named volume: container-local FS, but not a mount point —
  // export-mode builds rmdir the distDir root at the end).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  cleanDistDir: true,
  env: {
    NEXT_PUBLIC_PAGESPEED_API_KEY: process.env.NEXT_PUBLIC_PAGESPEED_API_KEY,
    // Deploy workflows omit NEXT_PUBLIC_BASE_PATH and rely on detect-project.js,
    // so the resolved basePath must be injected here or client code that builds
    // URLs (auth redirects) sees '' in production (issue #154).
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  webpack: (config, { isServer }) => {
    // Optimize code splitting for better performance
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunks for node_modules
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              reuseExistingChunk: true,
            },
            // Common chunks used across multiple pages
            common: {
              name: 'common',
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
            // Heavy libraries in separate chunks
            leaflet: {
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
              name: 'leaflet',
              priority: 20,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
