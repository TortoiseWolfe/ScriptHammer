/**
 * Selecting OpenDyslexic must actually render OpenDyslexic (#823).
 *
 * WHAT WENT WRONG. On production, choosing the dyslexia-friendly font silently gave the
 * reader **Comic Sans MS** — the next entry in its own stack. Measured live: the page
 * requested `/fonts/OpenDyslexic-Regular.woff2`, got a **300-byte 404 body**, loaded no
 * OpenDyslexic face, and never touched the CDN fallback.
 *
 * It was invisible because four things lined up:
 *
 *   1. `fonts.ts` pointed `url` at a woff2 that does not exist — there is no `public/fonts/`.
 *   2. That `url` SHADOWED the CDN entry in `FONT_URLS`, via `fontConfig.url || FONT_URLS[id]`,
 *      so the fallback could never fire.
 *   3. `font-loader` injects `<link rel="stylesheet">`. A raw `.woff2` as a stylesheet defines
 *      no `@font-face`, so it could not have worked even if the file existed.
 *   4. The loader's `onerror` marks the font loaded "to prevent retries" — so the 404 produced
 *      no error, no retry, and no signal.
 *
 * WHY THESE ASSERTIONS AND NOT THE OBVIOUS ONE. Every "is the font selected?" check passed
 * throughout the bug: the stack was applied correctly and `document.fonts.check('16px
 * "OpenDyslexic"')` returns **true**, because it answers "can this family be satisfied?" — and
 * a fallback satisfies it. So the tests below assert the face is DEFINED and its file is
 * REACHABLE, which is what was actually false.
 *
 * WHAT THIS CANNOT CHECK: that the glyphs render. That needs a browser against a real build,
 * and is verified against live production after deploy.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getFontById } from '@/config/fonts';

const ROOT = process.cwd();
const GLOBALS = join(ROOT, 'src', 'app', 'globals.css');
const LOADER = join(ROOT, 'src', 'utils', 'font-loader.ts');
const PKG = join(ROOT, 'package.json');

const globals = () => readFileSync(GLOBALS, 'utf8');
const loader = () => readFileSync(LOADER, 'utf8');
const openDyslexic = () => getFontById('opendyslexic');

describe('OpenDyslexic is really available, not just selectable (#823)', () => {
  it('the config entry exists, so the assertions below are not vacuous', () => {
    const cfg = openDyslexic();
    expect(cfg, 'no opendyslexic entry in fontConfigs').toBeTruthy();
    expect(cfg!.stack).toContain('OpenDyslexic');
  });

  it('names no URL of its own — the one it had 404s', () => {
    // `url` takes precedence over every other source, so a wrong one is unrecoverable:
    // it shadows the fallback rather than falling through to it.
    expect(
      openDyslexic()!.url,
      'opendyslexic declares a `url` again. That value wins over FONT_URLS and over the ' +
        'bundled @font-face, so if it is wrong the font fails silently to Comic Sans — ' +
        'exactly the #823 bug. The face is bundled; it needs no URL.'
    ).toBeUndefined();
  });

  it('the face is declared at build time from the OFL package', () => {
    // This is what makes the font available at all. Declaring @font-face costs nothing
    // until the font is used — the browser fetches the woff2 only when text needs it.
    expect(
      globals(),
      'globals.css no longer imports @fontsource/opendyslexic, so no @font-face defines ' +
        'the family and selecting it falls through to Comic Sans MS'
    ).toMatch(/@import\s+'@fontsource\/opendyslexic\/400\.css'/);

    const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
    const dep = pkg.dependencies?.['@fontsource/opendyslexic'];
    expect(dep, '@fontsource/opendyslexic is not a dependency').toBeTruthy();
  });

  it('the woff2 the CSS points at is actually present', () => {
    // The whole bug was a stylesheet naming a font file that did not exist. Resolve it
    // rather than trusting the import: a package can be installed and still not ship
    // the weight the CSS references.
    const cssPath = join(
      ROOT,
      'node_modules',
      '@fontsource',
      'opendyslexic',
      '400.css'
    );
    expect(existsSync(cssPath), `${cssPath} missing`).toBe(true);

    const css = readFileSync(cssPath, 'utf8');
    const files = [...css.matchAll(/url\(\.\/(files\/[^)'"]+\.woff2)\)/g)].map(
      (m) => m[1]
    );
    expect(
      files.length,
      'the package CSS references no woff2 at all'
    ).toBeGreaterThan(0);

    for (const rel of files) {
      const abs = join(
        ROOT,
        'node_modules',
        '@fontsource',
        'opendyslexic',
        rel
      );
      expect(
        existsSync(abs),
        `CSS references ${rel} but it is not on disk`
      ).toBe(true);
    }
  });

  it('a bundled font is never fetched at runtime', () => {
    // `loading: 'local'` means the face is already in the bundle. If the loader ever
    // fetches it again it is back to needing a URL — and a URL is what broke this.
    expect(openDyslexic()!.loading).toBe('local');
    expect(
      loader(),
      "font-loader no longer short-circuits `loading === 'local'`, so a bundled font " +
        'would be fetched over the network again'
    ).toMatch(/fontConfig\.loading === 'local'/);
  });

  it('no CDN fallback remains for it', () => {
    // fonts.cdnfonts.com was dead code — never requested, because `url` shadowed it.
    // Leaving it would re-add a third-party dependency the CSP would have to allow.
    expect(loader()).not.toContain('cdnfonts.com');
  });
});
