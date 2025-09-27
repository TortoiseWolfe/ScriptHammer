/**
 * Project Configuration
 * This module provides project-wide configuration with the following priority:
 * 1. Environment variables (highest priority)
 * 2. Default values (lowest priority)
 *
 * When forking this template:
 * - The scripts/detect-project.js script runs at build time to auto-detect settings
 * - Or set environment variables: NEXT_PUBLIC_PROJECT_NAME, NEXT_PUBLIC_PROJECT_OWNER
 */

// Default configuration
const defaultConfig = {
  projectName: 'ScriptHammer',
  projectOwner: 'TortoiseWolfe',
  projectDescription:
    'Opinionated Next.js template with PWA, theming, and interactive components',
  basePath: '',
};

/**
 * Get the current project configuration
 * Priority: Environment > Default
 *
 * This function reads environment variables fresh each time it's called,
 * allowing for proper testing and development flexibility.
 */
export function getProjectConfig() {
  // Read environment variables inside the function for proper testing
  const config = {
    projectName:
      process.env.NEXT_PUBLIC_PROJECT_NAME || defaultConfig.projectName,
    projectOwner:
      process.env.NEXT_PUBLIC_PROJECT_OWNER || defaultConfig.projectOwner,
    projectDescription: defaultConfig.projectDescription,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? defaultConfig.basePath,
  };

  // Computed values
  const projectUrl = `https://github.com/${config.projectOwner}/${config.projectName}`;

  // Deploy URL priority:
  // 1. NEXT_PUBLIC_DEPLOY_URL (custom domain)
  // 2. GitHub Pages (if basePath is set or if it's a GitHub project)
  // 3. localhost (for development)
  const deployUrl =
    process.env.NEXT_PUBLIC_DEPLOY_URL ||
    (config.basePath
      ? `https://${config.projectOwner.toLowerCase()}.github.io${config.basePath}`
      : process.env.NODE_ENV === 'production' ||
          process.env.GITHUB_ACTIONS === 'true'
        ? `https://${config.projectOwner.toLowerCase()}.github.io/${config.projectName}`
        : 'http://localhost:3000');

  return {
    ...config,
    projectUrl,
    deployUrl,
    // Paths with basePath included
    manifestPath: `${config.basePath}/manifest.json`,
    swPath: `${config.basePath}/sw.js`,
    faviconPath: `${config.basePath}/favicon.svg`,
    appleTouchIconPath: `${config.basePath}/apple-touch-icon.svg`,
  };
}

// Export as a singleton for backward compatibility
// Note: This caches values at module load time. For dynamic values,
// use getProjectConfig() directly to get fresh environment variables
export const projectConfig = getProjectConfig();

// Type export for TypeScript
export type ProjectConfig = ReturnType<typeof getProjectConfig>;

// Helper function to check if running in GitHub Pages
export function isGitHubPages(): boolean {
  const config = getProjectConfig();
  return (
    process.env.GITHUB_ACTIONS === 'true' ||
    (process.env.NODE_ENV === 'production' && !!config.basePath)
  );
}

// Helper function to get the full asset URL
export function getAssetUrl(path: string): string {
  const config = getProjectConfig();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.basePath}${cleanPath}`;
}

// Helper function for dynamic manifest generation
export function generateManifest() {
  const config = getProjectConfig();
  const basePath = config.basePath || '';

  return {
    name: `${config.projectName} - Modern Web Starter`,
    short_name: config.projectName,
    description: config.projectDescription,
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#570df8',
    background_color: '#ffffff',
    categories: ['developer', 'productivity', 'utilities'],
    icons: [
      {
        src: `${basePath}/favicon.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: `${basePath}/icon-192x192.svg`,
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: `${basePath}/icon-512x512.svg`,
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: `${basePath}/icon-maskable.svg`,
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: `${basePath}/screenshot-wide.png`,
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
      },
      {
        src: `${basePath}/screenshot-narrow.png`,
        sizes: '720x1280',
        type: 'image/png',
        form_factor: 'narrow',
      },
    ],
    shortcuts: [
      {
        name: 'Themes',
        url: `${basePath}/themes/`,
        description: 'Browse and switch themes',
      },
      {
        name: 'Components',
        url: `${basePath}/components/`,
        description: 'View component gallery',
      },
      {
        name: 'Accessibility',
        url: `${basePath}/accessibility/`,
        description: 'Adjust reading preferences',
      },
    ],
  };
}
