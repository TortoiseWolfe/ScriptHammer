import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getProjectConfig,
  isGitHubPages,
  getAssetUrl,
  generateManifest,
  projectConfig,
} from '../project.config';

// Mock environment variables
const originalEnv = process.env;

describe('Project Configuration', () => {
  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
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
        'Opinionated Next.js template'
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

  describe('generateManifest', () => {
    it('should generate a valid PWA manifest', () => {
      const manifest = generateManifest();

      expect(manifest.name).toContain('ScriptHammer');
      expect(manifest.short_name).toBe('ScriptHammer');
      expect(manifest.description).toContain('Opinionated Next.js template');
      expect(manifest.start_url).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#570df8');
      expect(manifest.background_color).toBe('#ffffff');
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
      expect(wideScreenshot?.sizes).toBe('1280x720');

      expect(narrowScreenshot).toBeDefined();
      expect(narrowScreenshot?.sizes).toBe('720x1280');
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
});
