/**
 * Project Configuration
 * This module provides project-wide configuration with the following priority:
 * 1. Environment variables (highest priority)
 * 2. Default values (lowest priority)
 *
 * Forking to build your own app:
 * - The scripts/detect-project.js script runs at build time to auto-detect settings
 * - Or set environment variables: NEXT_PUBLIC_PROJECT_NAME, NEXT_PUBLIC_PROJECT_OWNER
 */

// Default configuration
const defaultConfig = {
  projectName: 'ScriptHammer',
  projectOwner: 'TortoiseWolfe',
  projectDescription:
    'A production Next.js and Supabase platform with auth, payments, encrypted messaging, and an accessible offline-capable PWA',
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
    // A monitored address a visitor can write to when the contact FORM cannot
    // deliver. The form depends on a third-party key, and production shipped an
    // EMPTY one, so `/contact/` offered no working channel at all while Stripe
    // was pointing paying customers straight at it (#784).
    //
    // DEFAULTS TO EMPTY ON PURPOSE. This is a forkable template, and a hardcoded
    // address would put the upstream maintainer's inbox on every fork's contact
    // page — the #392 failure where one person's identity shipped to everyone.
    // Unset simply means the mailto is not rendered.
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '',
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

/**
 * Normalize a page path: leading slash always; trailing slash unless the
 * path carries a query/hash (trailingSlash: true exports emit
 * `route/index.html`, so the canonical page URL ends in `/` — hitting the
 * slashless form costs a GitHub Pages 301 that Supabase's exact-match
 * redirect allow-list won't recognize).
 */
function normalizePagePath(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  if (/[?#]/.test(withLeading)) return withLeading;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/**
 * basePath-prefixed path for hard navigations (window.location.href).
 * next/navigation's router prepends basePath automatically; raw
 * window.location assignments do not — on a GitHub Pages project site a
 * bare '/' escapes the app to the domain root (issue #154).
 */
export function getInternalUrl(path: string): string {
  const config = getProjectConfig();

  // THIS IS A PAGE HELPER. Handed an asset path it appends a trailing slash and
  // produces a URL that 404s — `/models/CesiumMan.glb/` when the file is served
  // at `/models/CesiumMan.glb`. That shipped (7c3d95e1) and left `/chatt/?diorama`
  // showing a "Page Error" card in production for a day and a half, because
  // useGLTF throws a failed fetch during render straight into the error boundary.
  //
  // The two helpers sit next to each other and differ by one trailing slash, so
  // the swap is easy to make and invisible in review. Make it loud instead:
  // throw where a developer or CI will see it, and in production fall back to the
  // asset-correct form so a visitor is never served the broken URL. Failing safe
  // in production and hard everywhere else is deliberate — a warning nobody reads
  // is how this reached users in the first place.
  // Scoped to INTERNAL paths. Two call sites pass data-driven hrefs
  // (TwinCanvas from twins/<slug>/links.local.json), and while manifest.ts:42
  // documents those as app-internal, throwing on input this function does not
  // control would be a worse bug than the one being prevented. Anything carrying
  // a scheme is somebody else's URL — leave it alone.
  const isInternal =
    !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith('//');
  const lastSegment = path.split(/[?#]/)[0].split('/').pop() ?? '';
  if (isInternal && /\.[a-z0-9]{2,5}$/i.test(lastSegment)) {
    const message =
      `getInternalUrl('${path}') looks like a static asset. It is for PAGE ` +
      `navigations and appends a trailing slash, which 404s for a file. ` +
      `Use getAssetUrl() instead.`;
    if (process.env.NODE_ENV !== 'production') throw new Error(message);
    console.warn(`[project.config] ${message}`);
    return getAssetUrl(path);
  }

  return `${config.basePath}${normalizePagePath(path)}`;
}

/**
 * Absolute URL for Supabase redirect params (emailRedirectTo, redirectTo).
 * Client-only: composes the runtime origin with the build-time basePath,
 * which is self-consistent for the bundle actually being served.
 */
export function getRedirectUrl(path: string): string {
  return `${window.location.origin}${getInternalUrl(path)}`;
}

// Helper function for dynamic manifest generation
export function generateManifest() {
  const config = getProjectConfig();
  const basePath = config.basePath || '';

  return {
    name: config.projectName,
    short_name: config.projectName,
    description: config.projectDescription,
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#1a1a2e',
    background_color: '#1a1a2e',
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
        src: `${basePath}/screenshots/desktop.png`,
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
      },
      {
        src: `${basePath}/screenshots/mobile.png`,
        sizes: '750x1334',
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
