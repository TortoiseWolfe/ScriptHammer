/**
 * Contract test for src/styles/reduced-motion.css
 *
 * jsdom doesn't apply imported stylesheets, so unit tests cannot observe
 * the actual animation suppression in a render. This test verifies the
 * contract at the source level: the rules exist, target the correct
 * Tailwind animation classes, and key off both triggers (the
 * prefers-reduced-motion media query AND the AccessibilityContext-driven
 * data-reduce-motion="true" attribute on <html>).
 *
 * If a Dice / DraggableDice / loading-spinner test starts failing because
 * the animation class name changed, update both the component AND the CSS
 * rule below — the assertions here will catch a mismatch.
 *
 * Spec: features/testing/037-game-a11y-tests/spec.md FR-022.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, 'reduced-motion.css'), 'utf8');

describe('reduced-motion.css', () => {
  it('contains a prefers-reduced-motion media query', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
  });

  it('contains a [data-reduce-motion="true"] attribute selector', () => {
    expect(css).toMatch(/\[data-reduce-motion=['"]true['"]\]/);
  });

  it('targets all four loud Tailwind animation classes', () => {
    for (const cls of [
      'animate-spin',
      'animate-bounce',
      'animate-pulse',
      'animate-ping',
    ]) {
      expect(css).toContain(`.${cls}`);
    }
  });

  it('disables the animation (animation: none) under both triggers', () => {
    // Both selector blocks must set animation: none. Counting twice is the
    // simplest way to assert the rule appears in both branches without
    // brittle whitespace matching.
    const matches = css.match(/animation:\s*none\s*!important/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
