import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Storybook Naming Convention Enforcement
 *
 * Standard: Story titles must match the filesystem path.
 *
 * | Directory                    | Title Prefix              |
 * |------------------------------|---------------------------|
 * | src/components/subatomic/    | Components/Subatomic/     |
 * | src/components/atomic/       | Components/Atomic/        |
 * | src/components/molecular/    | Components/Molecular/     |
 * | src/components/organisms/    | Components/Organisms/     |
 * | src/components/templates/    | Components/Templates/     |
 * | src/components/auth/         | Features/Authentication/  |
 * | src/components/map/          | Features/Map/             |
 * | src/components/payment/      | Features/Payment/         |
 * | src/components/privacy/      | Features/Privacy/         |
 * | src/components/forms/        | Features/Forms/           |
 * | src/lib/analytics/           | Utilities/Analytics/      |
 * | src/lib/logger/              | Utilities/Logger          |
 */

const CATEGORY_TITLE_MAP: Record<string, string> = {
  subatomic: 'Components/Subatomic',
  atomic: 'Components/Atomic',
  molecular: 'Components/Molecular',
  organisms: 'Components/Organisms',
  templates: 'Components/Templates',
  auth: 'Features/Authentication',
  map: 'Features/Map',
  payment: 'Features/Payment',
  privacy: 'Features/Privacy',
  forms: 'Features/Forms',
};

const LIB_TITLE_MAP: Record<string, string> = {
  analytics: 'Utilities/Analytics',
  logger: 'Utilities/Logger',
};

function findStoryFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findStoryFiles(fullPath));
    } else if (
      entry.name.endsWith('.stories.tsx') ||
      entry.name.endsWith('.stories.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractTitle(filePath: string): string | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match the meta title which always contains '/' for hierarchy (e.g., 'Components/Atomic/Button')
  // This avoids matching title properties in args objects (e.g., blog post titles)
  const match = content.match(/title:\s*['"]([^'"]*\/[^'"]+)['"]/);
  return match ? match[1] : null;
}

function getExpectedPrefix(filePath: string): string | null {
  const projectRoot = path.resolve(__dirname, '../..');

  // Check src/components/ paths
  const componentsMatch = filePath.match(/src\/components\/([^/]+)\//);
  if (componentsMatch) {
    const category = componentsMatch[1];
    // Direct component in src/components/ (e.g., SetupBanner)
    if (!CATEGORY_TITLE_MAP[category]) {
      // Check if it's actually a component directory (PascalCase)
      if (/^[A-Z]/.test(category)) {
        return 'Components';
      }
      return null;
    }
    return CATEGORY_TITLE_MAP[category];
  }

  // Check src/lib/ paths
  const libMatch = filePath.match(/src\/lib\/([^/]+)\//);
  if (libMatch) {
    const libCategory = libMatch[1];
    return LIB_TITLE_MAP[libCategory] || null;
  }

  return null;
}

describe('Storybook Naming Conventions', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const srcDir = path.join(projectRoot, 'src');
  const storyFiles = findStoryFiles(srcDir);

  it('should find story files', () => {
    expect(storyFiles.length).toBeGreaterThan(0);
  });

  describe('title conventions', () => {
    for (const filePath of storyFiles) {
      const relativePath = path.relative(projectRoot, filePath);

      it(`${relativePath} should have correct title prefix`, () => {
        const title = extractTitle(filePath);
        expect(title).not.toBeNull();

        const expectedPrefix = getExpectedPrefix(filePath);
        if (expectedPrefix) {
          expect(title).toMatch(
            new RegExp(`^${expectedPrefix.replace(/\//g, '\\/')}(\\/|$)`)
          );
        }
      });
    }
  });
});
