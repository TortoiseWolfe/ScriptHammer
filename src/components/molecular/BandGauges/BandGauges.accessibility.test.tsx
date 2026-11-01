import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BandGauges, { BandGaugeDefs } from './BandGauges';

expect.extend(toHaveNoViolations);

/** WCAG relative luminance contrast of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('BandGauges accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <div>
        <BandGaugeDefs />
        <BandGauges score={3} perDay={4.5} maxPerDay={15} net={1} />
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps every text colour at 4.5:1 or better on the surface it sits on', () => {
    // Plate text on both ends of the plate gradient.
    expect(contrast('#24140a', '#f0c878')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#24140a', '#d9a64f')).toBeGreaterThanOrEqual(4.5);
    // Note under the dials on the song card.
    expect(contrast('#d3bf98', '#2b1f19')).toBeGreaterThanOrEqual(4.5);
    // Dial lettering on the dial face (darkest face stop), and the readout window.
    expect(contrast('#24140a', '#c98f35')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffcf7a', '#0c0805')).toBeGreaterThanOrEqual(4.5);
  });

  it('adds no motion when the visitor asks for none', () => {
    // The sweep lives only inside a no-preference media query in globals.css.
    const css = readFileSync('src/app/globals.css', 'utf8');
    const rule = css.slice(css.indexOf('.band-needle'));
    expect(rule).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.band-needle\s*\{\s*animation:/
    );
    expect(rule.split('@media')[0]).not.toMatch(/animation|transition/);
  });
});
