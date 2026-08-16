/**
 * The build must not depend on Google being reachable (#730).
 *
 * `next/font/google` fetches every face from `fonts.gstatic.com` at BUILD time. That is a
 * third party on the critical path of every deploy, and it failed twice in twelve hours:
 * once killing the production deploy of an unrelated hotfix, once killing an E2E shard,
 * which then built nothing and executed 0 tests while looking like an ordinary red.
 *
 * The faces are now vendored — `src/fonts/*.woff2` plus `src/app/fonts.generated.css`,
 * which is `next/font`'s own output copied verbatim and repointed at those files. Proven by
 * building with `fonts.gstatic.com` blackholed: the build succeeds, and the same blocked
 * build on the pre-fix code fails with `Build failed because of webpack errors`.
 *
 * WHY THIS TEST EXISTS. Nothing else notices the regression. Adding one
 * `import { Inter } from 'next/font/google'` re-introduces the dependency for the WHOLE
 * build, and every check stays green right up until the day Google is briefly unreachable
 * and a deploy fails for reasons that have nothing to do with the change being deployed.
 *
 * If you need a new family: add it, build, run `node scripts/fonts/vendor-google-fonts.mjs`,
 * and commit `src/fonts/` and the generated stylesheet. Do not silence this test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const GENERATED = join(SRC, 'app', 'fonts.generated.css');
const FONT_DIR = join(SRC, 'fonts');

/** Every .ts/.tsx under src/, so a new font import anywhere is caught. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe('fonts are vendored, so the build never calls Google (#730)', () => {
  const files = sourceFiles(SRC);

  it('the scan found the source tree it is asserting about', () => {
    // Without this, a broken walk would make every assertion below pass vacuously.
    expect(
      files.length,
      'no .ts/.tsx found under src/ — this guard is anchored to a stale layout'
    ).toBeGreaterThan(100);
  });

  it('nothing imports next/font/google', () => {
    const offenders = files
      .filter((f) =>
        /from\s+['"]next\/font\/google['"]/.test(readFileSync(f, 'utf8'))
      )
      .map((f) => f.replace(ROOT + '/', ''));
    expect(
      offenders,
      'these re-introduce a build-time fetch to fonts.gstatic.com. Vendor the family ' +
        'instead: build, then `node scripts/fonts/vendor-google-fonts.mjs`, then commit ' +
        'src/fonts/ and src/app/fonts.generated.css'
    ).toEqual([]);
  });

  it('the vendored stylesheet and its files are present and wired in', () => {
    expect(
      existsSync(GENERATED),
      'src/app/fonts.generated.css is missing'
    ).toBe(true);
    const css = readFileSync(GENERATED, 'utf8');
    const faces = css.match(/@font-face/g) ?? [];
    expect(
      faces.length,
      'the vendored stylesheet declares no faces'
    ).toBeGreaterThan(0);

    // globals.css must actually import it — a stylesheet nobody imports is the #377 shape,
    // where faces were downloaded and rendered nowhere.
    const globals = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');
    expect(
      globals,
      'globals.css does not import fonts.generated.css, so no face is ever declared'
    ).toContain('fonts.generated.css');
  });

  it('every file the stylesheet references exists, and none is orphaned', () => {
    const css = readFileSync(GENERATED, 'utf8');
    const referenced = new Set(
      [...css.matchAll(/url\('\.\.\/fonts\/([^']+)'\)/g)].map((m) => m[1])
    );
    expect(
      referenced.size,
      'the stylesheet references no font files'
    ).toBeGreaterThan(0);

    const missing = [...referenced].filter(
      (f) => !existsSync(join(FONT_DIR, f))
    );
    expect(
      missing,
      'referenced but not committed — the build would 404 these'
    ).toEqual([]);

    const onDisk = readdirSync(FONT_DIR).filter((f) => f.endsWith('.woff2'));
    const orphaned = onDisk.filter((f) => !referenced.has(f));
    expect(
      orphaned,
      'committed but referenced by nothing — regenerate and delete the leftovers'
    ).toEqual([]);
  });

  it('keeps the size-adjust fallback faces that prevent layout shift', () => {
    // These carry `local("Arial")` + ascent-override/size-adjust and hold the layout still
    // while the real face loads. They are easy to lose in a hand-rolled rewrite, and losing
    // them causes CLS that no gate in this repo measures.
    const css = readFileSync(GENERATED, 'utf8');
    const adjusted = css.match(/size-adjust/g) ?? [];
    expect(
      adjusted.length,
      'no size-adjust fallback faces survived — text will jump as fonts load'
    ).toBeGreaterThan(0);
  });

  /**
   * THE PRELOAD LIST IS DERIVED, NOT MAINTAINED (#740).
   *
   * Vendoring cost the eight `<link rel="preload">` tags next/font emitted. They are back,
   * generated from the committed stylesheet by scripts/fonts/generate-preload-list.mjs.
   *
   * This asserts the generated module still matches the stylesheet. Re-vendor a font and
   * forget to regenerate, and the page preloads a face nothing uses — bytes downloaded for
   * nothing, which is worse than the missing preload was.
   */
  it('the preload list matches the .p faces in the stylesheet', () => {
    const preloadModule = readFileSync(
      join(ROOT, 'src/app/fonts-preload.generated.ts'),
      'utf8'
    );

    const css = readFileSync(GENERATED, 'utf8');
    const inCss = [
      ...new Set(
        Array.from(
          css.matchAll(/\.\.\/fonts\/([\w-]+-s\.p\.woff2)/g),
          (m) => m[1]
        )
      ),
    ].sort();
    const inModule = [
      ...new Set(
        Array.from(
          preloadModule.matchAll(/from '\.\.\/fonts\/([^']+)'/g),
          (m) => m[1]
        )
      ),
    ].sort();

    expect(
      inCss.length,
      'the stylesheet references no preloadable (.p) faces — this check would be vacuous'
    ).toBeGreaterThan(0);
    expect(
      inModule,
      'fonts-preload.generated.ts is out of sync with fonts.generated.css — run ' +
        '`node scripts/fonts/generate-preload-list.mjs`'
    ).toEqual(inCss);
  });

  it('preloads are IMPORTED so the bundler resolves the hash, never hardcoded', () => {
    // The bundler adds a second hash (x-s.p.woff2 -> x-s.p.1a4aa509.woff2), so a literal
    // URL is wrong the moment a font changes — and wrong silently, because a 404 preload
    // logs a console warning and nothing else.
    const preloadModule = readFileSync(
      join(ROOT, 'src/app/fonts-preload.generated.ts'),
      'utf8'
    );
    expect(preloadModule).toMatch(/^import face0 from '\.\.\/fonts\//m);
    expect(
      preloadModule,
      'a literal _next/static path in the preload list will not survive a rebuild'
    ).not.toMatch(/_next\/static/);
  });

  it('no url() still points at Google', () => {
    // ASSERT ON THE url() VALUES, NOT THE FILE TEXT. The first version matched the whole
    // file and failed on the generated banner, which says "the build no longer contacts
    // fonts.gstatic.com" — a guard that fires on its own prose is a guard someone deletes.
    // (Third time this exact trap appeared in one session; the other two were the HUD
    // contrast guard and the @hosted chip count.)
    const css = readFileSync(GENERATED, 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    );
    const urls = [...css.matchAll(/url\(([^)]*)\)/g)].map((m) => m[1]);
    expect(
      urls.length,
      'no url() found — is the stylesheet empty?'
    ).toBeGreaterThan(0);
    const remote = urls.filter((u) =>
      /fonts\.(gstatic|googleapis)\.com|^https?:/.test(u)
    );
    expect(
      remote,
      'a vendored face still fetches from the network at runtime, which is the ' +
        'dependency this change exists to remove'
    ).toEqual([]);
  });
});
