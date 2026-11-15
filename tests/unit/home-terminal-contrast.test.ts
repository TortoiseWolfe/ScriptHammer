import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The home page's terminal screen is a FIXED near-black in every theme, so any
 * text colour drawn on it must be fixed too (#1506).
 *
 * `var(--color-secondary)` is a dark brown (#7e3403) in the light theme, which made
 * the "ready · localhost:3000" line and the five definition labels beside it
 * 2.13:1 on that screen. WCAG 1.4.3 asks for 4.5:1. A theme token is the wrong
 * tool on a surface that does not repaint with the theme.
 *
 * This reads the source, as credits-page.test.ts does, because the contrast
 * itself is measured by tests/e2e/color-contrast.spec.ts and a jsdom render
 * cannot resolve oklch() colours.
 */
const SOURCE = readFileSync(
  join(process.cwd(), 'src', 'app', 'page.tsx'),
  'utf8'
);

describe('home page terminal screen (#1506)', () => {
  it('draws the completion line and the definition labels in the fixed accent', () => {
    expect(SOURCE).toMatch(/const TERMINAL_ACCENT = 'oklch\(/);
    expect(SOURCE).toMatch(/line\.done\s*\?\s*\{ color: TERMINAL_ACCENT \}/);
    expect(SOURCE).toMatch(/<dt[^>]*style=\{\{ color: TERMINAL_ACCENT \}\}/);
  });

  it('does not colour text on the terminal screen with the theme secondary', () => {
    const start = SOURCE.indexOf('const TERMINAL_LINES');
    const end = SOURCE.indexOf('Groove: facts, not metrics');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // The screen block is the TERMINAL_LINES data plus the JSX between the
    // "SCREEN" comment and the groove section.
    const screen = SOURCE.slice(SOURCE.indexOf('SCREEN —'), end);
    expect(screen.length).toBeGreaterThan(0);
    expect(screen).not.toContain('var(--color-secondary)');
  });
});
