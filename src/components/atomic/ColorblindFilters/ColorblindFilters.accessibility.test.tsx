import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ColorblindFilters } from './ColorblindFilters';

expect.extend(toHaveNoViolations);

describe('ColorblindFilters Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ColorblindFilters />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be hidden from assistive technologies', () => {
    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');

    // SVG should be hidden from screen readers
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('should not interfere with page navigation', () => {
    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');

    // Should not be focusable
    expect(svg).not.toHaveAttribute('tabIndex');

    // Should not contain any focusable elements
    const focusableElements = container.querySelectorAll(
      'a, button, input, select, textarea, [tabIndex]:not([tabIndex="-1"])'
    );
    expect(focusableElements).toHaveLength(0);
  });

  it('should not affect document structure', () => {
    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');

    // Should be properly hidden
    expect(svg).toHaveClass('hidden');

    // Should not have role that would announce to screen readers
    expect(svg).not.toHaveAttribute('role');
  });

  it('should maintain valid SVG structure', () => {
    const { container } = render(<ColorblindFilters />);

    // Check for valid SVG namespace
    const svg = container.querySelector('svg');
    expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');

    // Check for defs element
    const defs = svg?.querySelector('defs');
    expect(defs).toBeInTheDocument();

    // All filters should be inside defs
    const filters = container.querySelectorAll('filter');
    filters.forEach((filter) => {
      expect(filter.parentElement?.tagName.toLowerCase()).toBe('defs');
    });
  });

  it('should have unique IDs for all filters', () => {
    const { container } = render(<ColorblindFilters />);
    const filters = container.querySelectorAll('filter');

    const ids = new Set<string>();
    filters.forEach((filter) => {
      const id = filter.getAttribute('id');
      expect(id).toBeTruthy();
      expect(ids.has(id!)).toBe(false); // ID should be unique
      ids.add(id!);
    });
  });

  it('should not create duplicate filters when re-rendered', () => {
    const { container, rerender } = render(<ColorblindFilters />);

    // Count initial filters
    const initialFilters = container.querySelectorAll('filter').length;

    // Re-render component
    rerender(<ColorblindFilters />);

    // Should have same number of filters
    const afterFilters = container.querySelectorAll('filter').length;
    expect(afterFilters).toBe(initialFilters);
  });

  it('should work in high contrast mode', () => {
    // Set high contrast preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-contrast: high)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');

    // Filters should still be present
    expect(svg).toBeInTheDocument();
    const filters = container.querySelectorAll('filter');
    expect(filters.length).toBeGreaterThan(0);
  });

  it('should not cause layout shifts', () => {
    const { container } = render(
      <div>
        <p>Content before</p>
        <ColorblindFilters />
        <p>Content after</p>
      </div>
    );

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);

    // SVG should not affect layout
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('hidden');
  });

  it('should have valid color matrix values', () => {
    const { container } = render(<ColorblindFilters />);
    const colorMatrices = container.querySelectorAll('feColorMatrix');

    colorMatrices.forEach((matrix) => {
      const values = matrix.getAttribute('values');
      expect(values).toBeTruthy();

      // Values should be space-separated numbers
      const numbers = values!.split(/\s+/).map(Number);
      expect(numbers).toHaveLength(20); // 4x5 matrix

      // All values should be valid numbers
      numbers.forEach((num) => {
        expect(isNaN(num)).toBe(false);
      });
    });
  });

  it('should preserve color matrix type attribute', () => {
    const { container } = render(<ColorblindFilters />);
    const colorMatrices = container.querySelectorAll('feColorMatrix');

    colorMatrices.forEach((matrix) => {
      expect(matrix).toHaveAttribute('type', 'matrix');
    });
  });

  it('should be compatible with print media', () => {
    // Set print media
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === 'print',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');

    // Should still be hidden in print
    expect(svg).toHaveClass('hidden');
  });

  it('should not interfere with page semantics', async () => {
    const { container } = render(
      <main>
        <h1>Page Title</h1>
        <ColorblindFilters />
        <article>Content</article>
      </main>
    );

    // Check that page structure is maintained
    const main = container.querySelector('main');
    const h1 = container.querySelector('h1');
    const article = container.querySelector('article');

    expect(main).toBeInTheDocument();
    expect(h1).toBeInTheDocument();
    expect(article).toBeInTheDocument();

    // Run axe on the entire page
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
