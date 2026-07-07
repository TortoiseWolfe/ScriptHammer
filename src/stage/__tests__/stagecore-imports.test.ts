import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// NOTE: the brief's reference test used `new URL('../StageCore.tsx', import.meta.url)`
// directly as the readFileSync argument. Under this project's vitest `environment:
// 'jsdom'`, the global `URL` constructor is jsdom's polyfill (not Node's), which
// enforces its own scheme allowlist and throws "The URL must be of scheme file"
// before the path ever resolves — reproducible on ANY sibling file, not just a
// missing StageCore.tsx. Resolving through `fileURLToPath` + `path.join` sidesteps
// jsdom's URL entirely and gives readFileSync a plain string path instead.
describe('StageCore liftability', () => {
  it('imports nothing from world/packs/agents', () => {
    const stageCorePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../StageCore.tsx'
    );
    const src = readFileSync(stageCorePath, 'utf8');
    expect(src).not.toMatch(/from ['"]@?\/?.*\/(world|packs|agents)\//);
    expect(src).not.toMatch(/from ['"]\.\.\/(world|packs|agents)/);
  });
});
