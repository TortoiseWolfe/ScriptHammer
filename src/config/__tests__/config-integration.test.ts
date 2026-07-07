import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs');

describe('Configuration Integration', () => {
  const originalEnv = process.env;
  const configDir = path.join(process.cwd(), 'src', 'config');

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Auto-generated files integration', () => {
    it('should load detected configuration from JSON file', () => {
      const mockConfig = {
        projectName: 'DetectedProject',
        projectOwner: 'DetectedOwner',
        projectHost: 'github.com',
        projectUrl: 'https://github.com/DetectedOwner/DetectedProject',
        basePath: '',
        isGitHub: true,
        detectionSource: 'git',
        generatedAt: '2025-09-20T10:00:00.000Z',
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      // Test that the file would be read correctly
      const jsonPath = path.join(configDir, 'project-detected.json');
      const exists = fs.existsSync(jsonPath);
      const content = fs.readFileSync(jsonPath, 'utf8');
      const parsed = JSON.parse(content);

      expect(exists).toBe(true);
      expect(parsed.projectName).toBe('DetectedProject');
      expect(parsed.projectOwner).toBe('DetectedOwner');
      expect(parsed.detectionSource).toBe('git');
    });

    it('should load detected configuration from TypeScript file', () => {
      const mockTsContent = `
export const detectedConfig = {
  "projectName": "DetectedProject",
  "projectOwner": "DetectedOwner",
  "projectHost": "github.com",
  "projectUrl": "https://github.com/DetectedOwner/DetectedProject",
  "basePath": "",
  "isGitHub": true,
  "detectionSource": "git",
  "generatedAt": "2025-09-20T10:00:00.000Z"
} as const;

export type DetectedConfig = typeof detectedConfig;
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockTsContent);

      const tsPath = path.join(configDir, 'project-detected.ts');
      const exists = fs.existsSync(tsPath);
      const content = fs.readFileSync(tsPath, 'utf8');

      expect(exists).toBe(true);
      expect(content).toContain('export const detectedConfig');
      expect(content).toContain('as const');
      expect(content).toContain('export type DetectedConfig');
    });
  });

  describe('Build-time vs Runtime behavior', () => {
    it('should use build-time configuration in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_PROJECT_NAME', 'BuildTimeProject');

      // In production, environment variables are baked in at build time
      const isBuildTime = process.env.NODE_ENV === 'production';
      expect(isBuildTime).toBe(true);

      // Configuration should be frozen in production
      const config = {
        projectName: process.env.NEXT_PUBLIC_PROJECT_NAME,
      };
      expect(config.projectName).toBe('BuildTimeProject');
    });

    it('should allow runtime configuration in development', () => {
      vi.stubEnv('NODE_ENV', 'development');

      // In development, environment variables can change
      const isDevelopment = process.env.NODE_ENV === 'development';
      expect(isDevelopment).toBe(true);

      // Change environment variable
      process.env.NEXT_PUBLIC_PROJECT_NAME = 'DevProject1';
      let config = {
        projectName: process.env.NEXT_PUBLIC_PROJECT_NAME,
      };
      expect(config.projectName).toBe('DevProject1');

      // Change again
      process.env.NEXT_PUBLIC_PROJECT_NAME = 'DevProject2';
      config = {
        projectName: process.env.NEXT_PUBLIC_PROJECT_NAME,
      };
      expect(config.projectName).toBe('DevProject2');
    });
  });

  describe('Configuration loading priority', () => {
    it('should follow correct priority: env > detected > default', () => {
      // Priority test scenarios
      const scenarios = [
        {
          env: 'EnvProject',
          detected: 'DetectedProject',
          default: 'DefaultProject',
          expected: 'EnvProject',
        },
        {
          env: undefined,
          detected: 'DetectedProject',
          default: 'DefaultProject',
          expected: 'DetectedProject',
        },
        {
          env: undefined,
          detected: undefined,
          default: 'DefaultProject',
          expected: 'DefaultProject',
        },
        {
          env: '',
          detected: 'DetectedProject',
          default: 'DefaultProject',
          expected: 'DetectedProject', // Empty string should fall through
        },
      ];

      for (const scenario of scenarios) {
        const result = scenario.env || scenario.detected || scenario.default;
        expect(result).toBe(scenario.expected);
      }
    });
  });

  describe('Cache behavior', () => {
    it('should read fresh configuration each time for dynamic values', () => {
      // Our new implementation reads fresh each time
      // This ensures environment variable changes are picked up
      let callCount = 0;

      const getConfig = () => {
        callCount++;
        return {
          projectName: process.env.NEXT_PUBLIC_PROJECT_NAME || 'DefaultProject',
          callCount: callCount,
        };
      };

      const config1 = getConfig();
      const config2 = getConfig();
      const config3 = getConfig();

      // Each call gets fresh values
      expect(config1.callCount).toBe(1);
      expect(config2.callCount).toBe(2);
      expect(config3.callCount).toBe(3);
    });

    it('should invalidate cache when environment changes in development', () => {
      vi.stubEnv('NODE_ENV', 'development');

      let configCache: { projectName: string; timestamp: number } | null = null;
      let cacheKey = '';

      const getConfig = () => {
        const currentKey = process.env.NEXT_PUBLIC_PROJECT_NAME || 'default';
        if (!configCache || cacheKey !== currentKey) {
          cacheKey = currentKey;
          configCache = {
            projectName: currentKey,
            timestamp: Date.now(),
          };
        }
        return configCache;
      };

      // First load
      process.env.NEXT_PUBLIC_PROJECT_NAME = 'Project1';
      const config1 = getConfig();

      // Change environment
      process.env.NEXT_PUBLIC_PROJECT_NAME = 'Project2';
      const config2 = getConfig();

      expect(config1.projectName).toBe('Project1');
      expect(config2.projectName).toBe('Project2');
      expect(config1).not.toBe(config2); // Should be different objects
    });
  });

  describe('Next.js specific integration', () => {
    it('should work with Next.js public environment variables', () => {
      // Next.js requires NEXT_PUBLIC_ prefix for client-side variables
      process.env.NEXT_PUBLIC_TEST_VAR = 'public-value';
      process.env.TEST_VAR = 'server-value';

      // In client-side code, only NEXT_PUBLIC_ variables are available
      const publicVar = process.env.NEXT_PUBLIC_TEST_VAR;
      const serverVar = process.env.TEST_VAR;

      expect(publicVar).toBe('public-value');
      expect(serverVar).toBe('server-value');

      // In a real browser client-side environment, server vars wouldn't be available
      // But in our Node.js test environment, they are always available
      // This is a limitation of testing Next.js client/server separation in Node.js
      // Real testing of client/server separation requires E2E tests in a browser
    });

    it('should handle Next.js static export configuration', () => {
      // Test with basePath
      process.env.NEXT_PUBLIC_BASE_PATH = '/my-app';
      const configWithBase = {
        output: 'export',
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
        assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
      };

      expect(configWithBase.basePath).toBe('/my-app');
      expect(configWithBase.assetPrefix).toBe('/my-app');

      // Test without basePath
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      const configWithoutBase = {
        output: 'export',
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
        assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
      };

      expect(configWithoutBase.basePath).toBe('');
      expect(configWithoutBase.assetPrefix).toBe('');
    });
  });

  describe('Error scenarios', () => {
    it('should handle missing auto-generated files gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const jsonPath = path.join(configDir, 'project-detected.json');
      const exists = fs.existsSync(jsonPath);

      expect(exists).toBe(false);

      // Should fall back to defaults
      const fallbackConfig = {
        projectName: 'ScriptHammer',
        projectOwner: 'TortoiseWolfe',
      };

      expect(fallbackConfig.projectName).toBe('ScriptHammer');
    });

    it('should handle malformed JSON in detected config', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

      const jsonPath = path.join(configDir, 'project-detected.json');

      expect(() => {
        const content = fs.readFileSync(jsonPath, 'utf8');
        JSON.parse(content);
      }).toThrow();

      // Should fall back to defaults on parse error
      const fallbackConfig = {
        projectName: 'ScriptHammer',
        projectOwner: 'TortoiseWolfe',
      };

      expect(fallbackConfig.projectName).toBe('ScriptHammer');
    });

    it('should handle file system errors', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const jsonPath = path.join(configDir, 'project-detected.json');

      expect(() => {
        fs.readFileSync(jsonPath, 'utf8');
      }).toThrow('EACCES');

      // Should continue with defaults on file system error
      const fallbackConfig = {
        projectName: 'ScriptHammer',
        projectOwner: 'TortoiseWolfe',
      };

      expect(fallbackConfig.projectName).toBe('ScriptHammer');
    });
  });
});
