import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Icon from './Icon';
import { ICON_NAMES, ICON_PATHS, type IconName } from './icons';

describe('Icon', () => {
  it('renders the path data for the requested name', () => {
    const { container } = render(<Icon name="menu" label="Open menu" />);
    expect(container.querySelector('path')).toHaveAttribute(
      'd',
      ICON_PATHS.menu
    );
  });

  it('scales with the surrounding font size by default', () => {
    // 1em rather than a fixed pixel size, so icons track the accessibility
    // font scale instead of shrinking relative to text a user enlarged.
    const { container } = render(<Icon name="check" decorative />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '1em');
  });

  it('accepts an explicit size', () => {
    const { container } = render(<Icon name="check" decorative size={32} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
  });

  it.each(ICON_NAMES)('renders %s', (name) => {
    const { container } = render(<Icon name={name} decorative />);
    expect(container.querySelector('path')?.getAttribute('d')).toBe(
      ICON_PATHS[name as IconName]
    );
  });

  /**
   * The grid rules from icons.ts, enforced.
   *
   * Hand-drawing the set traded a dependency for a consistency risk: whoever
   * adds the next icon has to match a grid they cannot see. A comment is not
   * enough, so the rules are checked here and the set cannot quietly drift as
   * it grows.
   */
  describe('grid discipline', () => {
    const coordsOf = (d: string) =>
      (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

    /**
     * The numeric checks below are only meaningful because the set is
     * restricted to absolute commands. With relative ones (`l`, `h`, `a`…) the
     * string carries deltas like `-8`, which are legitimate but are not
     * coordinates — the first draft of this test read them as such and
     * reported fourteen false failures. This assertion is what keeps the other
     * two honest, so it goes first.
     */
    it.each(ICON_NAMES)('%s uses absolute commands only', (name) => {
      const relative = (ICON_PATHS[name as IconName].match(/[a-z]/g) ?? [])
        // `e` would only appear in exponent notation, which is also banned.
        .filter((c) => c !== ' ');
      expect(
        relative,
        `${name} uses relative path commands (${relative.join(', ')}), which ` +
          `makes the grid checks below unable to tell a coordinate from a delta`
      ).toEqual([]);
    });

    it.each(ICON_NAMES)('%s stays within the 24-unit viewBox', (name) => {
      const outOfBounds = coordsOf(ICON_PATHS[name as IconName]).filter(
        (n) => n < 0 || n > 24
      );
      expect(
        outOfBounds,
        `${name} has coordinates outside the viewBox: ${outOfBounds.join(', ')}`
      ).toEqual([]);
    });

    it.each(ICON_NAMES)('%s snaps to whole or half units', (name) => {
      const offGrid = coordsOf(ICON_PATHS[name as IconName]).filter(
        (n) => Math.abs(n * 2 - Math.round(n * 2)) > 1e-9
      );
      expect(
        offGrid,
        `${name} has off-grid coordinates, which is what makes a hand-drawn ` +
          `set look uneven next to text: ${offGrid.join(', ')}`
      ).toEqual([]);
    });

    it('has no duplicate path data', () => {
      // Two names resolving to the same drawing means one of them is wrong.
      const byPath = new Map<string, string[]>();
      for (const name of ICON_NAMES) {
        const d = ICON_PATHS[name as IconName];
        byPath.set(d, [...(byPath.get(d) ?? []), name]);
      }
      expect([...byPath.values()].filter((names) => names.length > 1)).toEqual(
        []
      );
    });
  });

  it('exposes every path through ICON_NAMES', () => {
    expect(ICON_NAMES.length).toBe(Object.keys(ICON_PATHS).length);
  });

  it('gives a labelled icon an accessible name', () => {
    render(<Icon name="menu" label="Open menu" />);
    expect(screen.getByRole('img', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('hides a decorative icon from assistive technology', () => {
    render(<Icon name="menu" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
