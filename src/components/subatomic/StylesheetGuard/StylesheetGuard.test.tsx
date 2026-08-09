import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StylesheetGuard from './StylesheetGuard';

/**
 * These assert the SHAPE of the emitted script, not its runtime behaviour.
 *
 * jsdom cannot reproduce the bug: it does not fetch stylesheets, so a `<link>`
 * never 404s and `document.styleSheets` never carries an empty external sheet.
 * The behavioural proof lives in `scripts/check-stale-html.mjs`, which drives a
 * real Chromium, covers healthy / all-dead / one-dead / no-sheets, and is
 * mutation-proven — disabling the guard fails the required `accessibility` check.
 *
 * What is worth pinning HERE is the set of properties whose loss would make that
 * runtime guard dangerous or dead, and which a careless edit could remove without
 * any browser noticing: the loop stopper, the deferral to `load`, and the fact
 * that it navigates rather than reloads.
 */
describe('StylesheetGuard', () => {
  const scriptText = () => {
    const { container } = render(<StylesheetGuard />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    return script!.innerHTML;
  };

  /**
   * The script explains in comments WHY it avoids `location.reload()` and
   * `DOMContentLoaded`, so a naive absence check matches the prose and fails on
   * correct code — which is exactly what happened when these were first written.
   * Assert against code only.
   */
  const codeOnly = () =>
    scriptText()
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

  it('renders an inline script and nothing visible', () => {
    const { container } = render(<StylesheetGuard />);
    const script = container.querySelector('script');
    expect(script).toBeInTheDocument();
    expect(script?.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('cannot loop — it records a sessionStorage flag and bails when set', () => {
    // A reload loop is strictly worse than an unstyled page, so this is the single
    // most important property of the script.
    const s = scriptText();
    expect(s).toContain('sh-stylesheet-recovered');
    expect(s).toMatch(/sessionStorage\.getItem\([^)]*\)\)?\s*return/);
    expect(s).toContain('sessionStorage.setItem');
  });

  it('waits for load, not DOMContentLoaded', () => {
    // At DOMContentLoaded a stylesheet may still be in flight and would read as
    // missing, turning a slow network into a reload.
    expect(codeOnly()).toContain("addEventListener('load'");
    expect(codeOnly()).not.toContain('DOMContentLoaded');
  });

  it('navigates to a fresh URL rather than calling reload()', () => {
    // location.reload() can re-serve the same cached document, which is exactly
    // what is broken.
    const s = codeOnly();
    expect(s).toContain('location.replace');
    expect(s).not.toMatch(/location\.reload\s*\(/);
  });

  it('decides on empty rule lists, not on styleSheets.length', () => {
    // Inline <style> and framework-injected sheets inflate `.length`, so it is
    // never 0 even when every external sheet is gone. Two earlier detectors could
    // never fire; see the component docblock.
    const s = codeOnly();
    expect(s).toContain('cssRules');
    expect(s).not.toMatch(/document\.styleSheets\.length\s*===?\s*0/);
  });

  it('only recovers when EVERY same-origin sheet is dead', () => {
    // Conservative by design: one dead sheet is not obviously fixed by refetching.
    expect(scriptText()).toContain('empty < external');
  });

  it('is wrapped so a missing sessionStorage cannot break the page', () => {
    const s = scriptText();
    expect(s).toContain('try {');
    expect(s).toContain('catch');
  });
});
