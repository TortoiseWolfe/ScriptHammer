import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import AccessibilityScript from './AccessibilityScript';
import {
  ACCESSIBILITY_STORAGE_KEYS,
  CONSENT_STORAGE_KEY,
  FONT_SCALE_FACTORS,
  LINE_HEIGHTS,
} from '@/config/accessibility-tokens';

/**
 * The component's own docblock names two contracts. Both are pinned here, because both
 * are the kind a careless edit removes without anything noticing:
 *
 *  1. The storage read is CONSENT-GATED. ThemeScript reads localStorage unconditionally;
 *     this must not, because the provider only persists there when FUNCTIONAL cookies are
 *     allowed and uses sessionStorage otherwise.
 *  2. Token values are SERIALISED FROM the shared module, never retyped, so they cannot
 *     drift from what AccessibilityProvider applies on hydration.
 */
const scriptText = () => {
  const { container } = render(<AccessibilityScript />);
  const script = container.querySelector('script');
  expect(script).not.toBeNull();
  return script!.innerHTML;
};

/** The script explains in comments what it avoids, so match against CODE only. */
const codeOnly = () =>
  scriptText()
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.style.cssText = '';
});

describe('AccessibilityScript', () => {
  it('renders one inline script and nothing visible', () => {
    const { container } = render(<AccessibilityScript />);
    expect(container.querySelectorAll('*')).toHaveLength(1);
    expect(container.querySelector('script')).not.toBeNull();
  });

  it('CONSULTS CONSENT rather than reading localStorage unconditionally', () => {
    // Contract 1. Without the gate, every user who declined functional cookies would
    // silently get the CSS default and a re-typeset on hydration.
    const code = codeOnly();
    expect(code).toContain(JSON.stringify(CONSENT_STORAGE_KEY));
    expect(code).toContain('sessionStorage');
  });

  it('embeds the REAL token values from the shared module, not retyped copies', () => {
    // Contract 2, and the assertion is derived from the module rather than hardcoded —
    // so changing a token in one place and not the other fails here.
    // Assert the WHOLE serialised object, never the individual values. A per-value
    // toContain() is vacuous here: FONT_SCALE_FACTORS.medium is 1, and "1" appears
    // all over the script, so retyping the table survived that check when it was
    // mutation-tested. The object literal is exact.
    const code = codeOnly();
    expect(code).toContain(JSON.stringify(FONT_SCALE_FACTORS));
    expect(code).toContain(JSON.stringify(LINE_HEIGHTS));
    expect(code).toContain(JSON.stringify(ACCESSIBILITY_STORAGE_KEYS));
  });

  it('never lets a storage or parse failure block paint', () => {
    // Its own comment promises this. A throw here would mean a blank first paint.
    expect(codeOnly()).toMatch(/catch\s*\(/);
  });

  it('escapes "<" so a token value could not terminate the tag early', () => {
    // The embed helper escapes `<` deliberately; a raw `</script>` in a token would
    // otherwise end the script element mid-object.
    expect(scriptText()).not.toMatch(/<\/script>/i);
  });
});
