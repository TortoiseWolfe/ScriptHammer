import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getProjectConfig,
  isGitHubPages,
  getAssetUrl,
  getInternalUrl,
  getRedirectUrl,
  generateManifest,
  projectConfig,
} from '../project.config';

// Mock environment variables
const originalEnv = process.env;

describe('Project Configuration', () => {
  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    // Clear project-specific env vars so tests start from defaults.
    // Docker injects .env values into container process.env, but Vitest
    // doesn't load .env.local (only Next.js does), so we must clean manually.
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.NEXT_PUBLIC_DEPLOY_URL;
    delete process.env.NEXT_PUBLIC_PROJECT_NAME;
    delete process.env.NEXT_PUBLIC_PROJECT_OWNER;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('getProjectConfig', () => {
    it('should return default configuration when no environment variables are set', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('GITHUB_ACTIONS', undefined);
      delete process.env.NEXT_PUBLIC_DEPLOY_URL;

      const config = getProjectConfig();

      expect(config.projectName).toBe('ScriptHammer');
      expect(config.projectOwner).toBe('TortoiseWolfe');
      expect(config.projectDescription).toContain(
        'production Next.js and Supabase platform'
      );
      expect(config.basePath).toBe('');
      expect(config.deployUrl).toBe('http://localhost:3000');
    });

    it('should prioritize environment variables over defaults', () => {
      process.env.NEXT_PUBLIC_PROJECT_NAME = 'TestProject';
      process.env.NEXT_PUBLIC_PROJECT_OWNER = 'TestOwner';
      process.env.NEXT_PUBLIC_BASE_PATH = '/test-base';

      const config = getProjectConfig();

      expect(config.projectName).toBe('TestProject');
      expect(config.projectOwner).toBe('TestOwner');
      expect(config.basePath).toBe('/test-base');
      expect(config.projectUrl).toBe(
        'https://github.com/TestOwner/TestProject'
      );
    });

    it('should use custom deploy URL when NEXT_PUBLIC_DEPLOY_URL is set', () => {
      process.env.NEXT_PUBLIC_DEPLOY_URL = 'https://custom-domain.com';

      const config = getProjectConfig();

      expect(config.deployUrl).toBe('https://custom-domain.com');
    });

    it('should generate GitHub Pages URL when basePath is set but no custom deploy URL', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/my-repo';
      delete process.env.NEXT_PUBLIC_DEPLOY_URL;

      const config = getProjectConfig();

      expect(config.deployUrl).toBe('https://tortoisewolfe.github.io/my-repo');
    });

    it('should handle deployment URL priority correctly', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      // Priority 1: Custom domain
      process.env.NEXT_PUBLIC_DEPLOY_URL = 'https://custom.com';
      process.env.NEXT_PUBLIC_BASE_PATH = '/repo';

      let config = getProjectConfig();
      expect(config.deployUrl).toBe('https://custom.com');

      // Priority 2: GitHub Pages (remove custom URL)
      delete process.env.NEXT_PUBLIC_DEPLOY_URL;

      config = getProjectConfig();
      expect(config.deployUrl).toBe('https://tortoisewolfe.github.io/repo');

      // Priority 3: Localhost (remove basePath in development)
      delete process.env.NEXT_PUBLIC_BASE_PATH;

      config = getProjectConfig();
      expect(config.deployUrl).toBe('http://localhost:3000');
    });

    it('should generate correct asset paths', () => {
      const config = getProjectConfig();

      expect(config.manifestPath).toBe('/manifest.json');
      expect(config.swPath).toBe('/sw.js');
      expect(config.faviconPath).toBe('/favicon.svg');
      expect(config.appleTouchIconPath).toBe('/apple-touch-icon.svg');
    });

    it('should include basePath in asset paths when set', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/my-app';

      const config = getProjectConfig();

      expect(config.manifestPath).toBe('/my-app/manifest.json');
      expect(config.swPath).toBe('/my-app/sw.js');
      expect(config.faviconPath).toBe('/my-app/favicon.svg');
      expect(config.appleTouchIconPath).toBe('/my-app/apple-touch-icon.svg');
    });
  });

  describe('isGitHubPages', () => {
    it('should return true when GITHUB_ACTIONS is set', () => {
      vi.stubEnv('GITHUB_ACTIONS', 'true');
      vi.stubEnv('NODE_ENV', 'development');

      expect(isGitHubPages()).toBe(true);
    });

    it('should return true when in production with basePath', () => {
      delete process.env.GITHUB_ACTIONS;
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/repo');

      expect(isGitHubPages()).toBe(true);
    });

    it('should return false when not in GitHub Actions and no basePath', () => {
      delete process.env.GITHUB_ACTIONS;
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.NEXT_PUBLIC_BASE_PATH;

      expect(isGitHubPages()).toBe(false);
    });

    it('should return false in development without GITHUB_ACTIONS', () => {
      delete process.env.GITHUB_ACTIONS;
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/repo');

      expect(isGitHubPages()).toBe(false);
    });
  });

  describe('getAssetUrl', () => {
    it('should prepend basePath to asset paths', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/my-app';

      expect(getAssetUrl('/image.png')).toBe('/my-app/image.png');
      expect(getAssetUrl('styles.css')).toBe('/my-app/styles.css');
    });

    it('should handle paths without leading slash', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/base';

      expect(getAssetUrl('asset.js')).toBe('/base/asset.js');
    });

    it('should work without basePath', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;

      expect(getAssetUrl('/asset.js')).toBe('/asset.js');
      expect(getAssetUrl('asset.js')).toBe('/asset.js');
    });
  });

  // The two helpers differ by ONE trailing slash and are one letter apart at the
  // call site. playerCharacter.tsx used getInternalUrl for a .glb; it produced
  // `/models/CesiumMan.glb/`, which 404s while the slashless form serves 200, and
  // useGLTF threw that during render into the page error boundary. `/chatt/?diorama`
  // was a "Page Error" card in production for a day and a half (7c3d95e1).
  describe('page helper vs asset helper (the trailing slash)', () => {
    it('getAssetUrl leaves an asset path alone; getInternalUrl would not', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      expect(getAssetUrl('/models/CesiumMan.glb')).toBe(
        '/models/CesiumMan.glb'
      );
      expect(getAssetUrl('/models/CesiumMan.glb').endsWith('/')).toBe(false);
    });

    it('getInternalUrl REFUSES an asset path rather than 404-ing a visitor', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      expect(() => getInternalUrl('/models/CesiumMan.glb')).toThrow(
        /looks like a static asset/
      );
      expect(() => getInternalUrl('/favicon.ico')).toThrow();
      expect(() => getInternalUrl('/data/buildings.json')).toThrow();
    });

    it('still canonicalizes real page paths — the 27 legitimate callers', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      for (const p of [
        '/',
        '/sign-in',
        '/pricing',
        '/auth/callback',
        '/verify-email',
        '/twins/chatt/',
      ]) {
        expect(() => getInternalUrl(p)).not.toThrow();
        expect(getInternalUrl(p).endsWith('/')).toBe(true);
      }
    });

    it('leaves a query or hash path alone, as before', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      expect(getInternalUrl('/sign-in?error=x')).toBe('/sign-in?error=x');
      expect(getInternalUrl('/page#section')).toBe('/page#section');
      expect(getInternalUrl('/twins/chatt/?house')).toBe('/twins/chatt/?house');
    });

    // TwinCanvas passes data-driven hrefs from links.local.json. Throwing on
    // input this function does not control would be worse than the bug it guards.
    it('never throws on a URL that carries a scheme', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      expect(() =>
        getInternalUrl('https://example.com/spec.pdf')
      ).not.toThrow();
      expect(() => getInternalUrl('mailto:a@b.co')).not.toThrow();
      expect(() => getInternalUrl('//cdn.example.com/x.js')).not.toThrow();
    });
  });

  describe('getInternalUrl / getRedirectUrl (issue #154)', () => {
    it('prefixes basePath and canonicalizes the trailing slash', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/RescueDogs';

      expect(getInternalUrl('/')).toBe('/RescueDogs/');
      expect(getInternalUrl('/auth/callback')).toBe(
        '/RescueDogs/auth/callback/'
      );
      expect(getInternalUrl('/auth/callback/')).toBe(
        '/RescueDogs/auth/callback/'
      );
      expect(getInternalUrl('auth/callback')).toBe(
        '/RescueDogs/auth/callback/'
      );
    });

    it('degrades to the bare path when basePath is unset', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;

      expect(getInternalUrl('/')).toBe('/');
      expect(getInternalUrl('/verify-email')).toBe('/verify-email/');
    });

    it('leaves paths with a query or hash unsuffixed', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/RescueDogs';

      expect(getInternalUrl('/sign-in?error=auth_callback_failed')).toBe(
        '/RescueDogs/sign-in?error=auth_callback_failed'
      );
      expect(getInternalUrl('/page#section')).toBe('/RescueDogs/page#section');
    });

    it('builds absolute Supabase redirect URLs from the runtime origin plus basePath', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/RescueDogs';

      expect(getRedirectUrl('/auth/callback')).toBe(
        'http://localhost:3000/RescueDogs/auth/callback/'
      );

      delete process.env.NEXT_PUBLIC_BASE_PATH;
      expect(getRedirectUrl('/auth/callback')).toBe(
        'http://localhost:3000/auth/callback/'
      );
    });
  });

  describe('generateManifest', () => {
    it('should generate a valid PWA manifest', () => {
      const manifest = generateManifest();

      expect(manifest.name).toContain('ScriptHammer');
      expect(manifest.short_name).toBe('ScriptHammer');
      expect(manifest.description).toContain(
        'production Next.js and Supabase platform'
      );
      expect(manifest.start_url).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#1a1a2e');
      expect(manifest.background_color).toBe('#1a1a2e');
    });

    it('should include basePath in manifest URLs when set', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/app';

      const manifest = generateManifest();

      expect(manifest.start_url).toBe('/app/');
      expect(manifest.scope).toBe('/app/');
      expect(manifest.icons[0].src).toBe('/app/favicon.svg');
    });

    it('should include all required icon sizes', () => {
      const manifest = generateManifest();

      const iconSizes = manifest.icons.map((icon) => icon.sizes);
      expect(iconSizes).toContain('any');
      expect(iconSizes).toContain('192x192');
      expect(iconSizes).toContain('512x512');

      const maskableIcon = manifest.icons.find(
        (icon) => icon.purpose === 'maskable'
      );
      expect(maskableIcon).toBeDefined();
    });

    /**
     * #659: this used to assert `1280x720` and `720x1280` for
     * `/screenshot-wide.png` and `/screenshot-narrow.png` — two files that have
     * never existed in this repo and returned 404 on production. The test
     * passed the whole time, because it only ever compared the config to
     * itself; nothing checked that the files were real or that the dimensions
     * described them.
     *
     * Now it pins the actual shipped screenshots at their measured sizes. The
     * files-exist-and-match half is enforced by
     * `scripts/__tests__/manifest-assets.test.js`, which reads the PNG headers.
     */
    it('should include screenshots for wide and narrow formats', () => {
      const manifest = generateManifest();

      expect(manifest.screenshots).toHaveLength(2);

      const wideScreenshot = manifest.screenshots.find(
        (s) => s.form_factor === 'wide'
      );
      const narrowScreenshot = manifest.screenshots.find(
        (s) => s.form_factor === 'narrow'
      );

      expect(wideScreenshot).toBeDefined();
      expect(wideScreenshot?.src).toContain('/screenshots/desktop.png');
      expect(wideScreenshot?.sizes).toBe('1920x1080');

      expect(narrowScreenshot).toBeDefined();
      expect(narrowScreenshot?.src).toContain('/screenshots/mobile.png');
      expect(narrowScreenshot?.sizes).toBe('750x1334');
    });

    it('should include application shortcuts', () => {
      const manifest = generateManifest();

      expect(manifest.shortcuts).toHaveLength(3);

      const shortcuts = manifest.shortcuts.map((s) => s.name);
      expect(shortcuts).toContain('Themes');
      expect(shortcuts).toContain('Components');
      expect(shortcuts).toContain('Accessibility');
    });

    it('should use custom project name in manifest', () => {
      process.env.NEXT_PUBLIC_PROJECT_NAME = 'MyApp';

      const manifest = generateManifest();

      expect(manifest.name).toContain('MyApp');
      expect(manifest.short_name).toBe('MyApp');
    });
  });

  describe('projectConfig singleton', () => {
    it('should export a singleton configuration object', () => {
      expect(projectConfig).toBeDefined();
      expect(projectConfig.projectName).toBe('ScriptHammer');
      expect(projectConfig.projectOwner).toBe('TortoiseWolfe');
    });

    it('should have all required properties', () => {
      expect(projectConfig).toHaveProperty('projectName');
      expect(projectConfig).toHaveProperty('projectOwner');
      expect(projectConfig).toHaveProperty('projectDescription');
      expect(projectConfig).toHaveProperty('basePath');
      expect(projectConfig).toHaveProperty('projectUrl');
      expect(projectConfig).toHaveProperty('deployUrl');
      expect(projectConfig).toHaveProperty('manifestPath');
      expect(projectConfig).toHaveProperty('swPath');
      expect(projectConfig).toHaveProperty('faviconPath');
      expect(projectConfig).toHaveProperty('appleTouchIconPath');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string environment variables', () => {
      process.env.NEXT_PUBLIC_PROJECT_NAME = '';
      process.env.NEXT_PUBLIC_PROJECT_OWNER = '';

      const config = getProjectConfig();

      // Should fall back to defaults
      expect(config.projectName).toBe('ScriptHammer');
      expect(config.projectOwner).toBe('TortoiseWolfe');
    });

    it('should handle undefined environment variables gracefully', () => {
      delete process.env.NEXT_PUBLIC_PROJECT_NAME;
      delete process.env.NEXT_PUBLIC_PROJECT_OWNER;

      const config = getProjectConfig();

      // Should fall back to defaults
      expect(config.projectName).toBe('ScriptHammer');
      expect(config.projectOwner).toBe('TortoiseWolfe');
    });

    it('should handle basePath with trailing slash', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/app/';

      const config = getProjectConfig();

      // Should still work correctly
      expect(config.manifestPath).toBe('/app//manifest.json');
    });

    it('should prioritize custom deploy URL over all other URL generation', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      // Test with custom domain - should override everything
      process.env.NEXT_PUBLIC_DEPLOY_URL = 'https://custom-domain.com';
      process.env.NEXT_PUBLIC_PROJECT_OWNER = 'TestOwner';

      const config = getProjectConfig();
      expect(config.deployUrl).toBe('https://custom-domain.com');

      // Custom domain should still take priority even with basePath set
      process.env.NEXT_PUBLIC_BASE_PATH = '/repo';
      const configWithBase = getProjectConfig();
      expect(configWithBase.deployUrl).toBe('https://custom-domain.com');
    });
  });

  /**
   * `supportEmail` drives a `mailto:` on /contact/ and inside the contact form's
   * error state (#784). The DEFAULT is the load-bearing half: a fork that inherits
   * an address publishes an inbox it does not own and cannot read — the #392
   * failure, one person's identity shipped to everyone, reappearing on the page
   * paying customers are sent to by Stripe receipts.
   */
  describe('supportEmail (#784)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    });

    it('defaults to empty so a fork never advertises an inbox it does not own', () => {
      expect(getProjectConfig().supportEmail).toBe('');
    });

    it('never falls back to a hardcoded address', () => {
      // Stated as a property, not a value: ANY future default is the defect,
      // whichever address someone picks.
      expect(getProjectConfig().supportEmail).not.toMatch(/@/);
    });

    it('uses the configured address when set', () => {
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'help@example.org';

      expect(getProjectConfig().supportEmail).toBe('help@example.org');
    });

    it('treats an empty value as unset rather than rendering an empty mailto', () => {
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL = '';

      expect(getProjectConfig().supportEmail).toBe('');
    });
  });
});
