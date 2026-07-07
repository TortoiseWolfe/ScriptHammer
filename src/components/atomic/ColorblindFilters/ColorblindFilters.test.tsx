import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ColorblindFilters } from './ColorblindFilters';
import { ColorblindType } from '@/utils/colorblind';
import {
  COLORBLIND_MATRICES,
  matrixToSVGString,
} from '@/utils/colorblind-matrices';

describe('ColorblindFilters', () => {
  it('should render SVG element with filters', () => {
    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should be hidden from view', () => {
    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('hidden');
  });

  it('should have aria-hidden attribute', () => {
    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('should contain defs element', () => {
    const { container } = render(<ColorblindFilters />);
    const defs = container.querySelector('svg defs');
    expect(defs).toBeInTheDocument();
  });

  it('should contain filter for protanopia', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#protanopia');
    expect(filter).toBeInTheDocument();
    expect(filter?.tagName.toLowerCase()).toBe('filter');
  });

  it('should contain filter for protanomaly', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#protanomaly');
    expect(filter).toBeInTheDocument();
    expect(filter?.tagName.toLowerCase()).toBe('filter');
  });

  it('should contain filter for deuteranopia', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#deuteranopia');
    expect(filter).toBeInTheDocument();
    expect(filter?.tagName.toLowerCase()).toBe('filter');
  });

  it('should contain filter for deuteranomaly', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#deuteranomaly');
    expect(filter).toBeInTheDocument();
    expect(filter?.tagName.toLowerCase()).toBe('filter');
  });

  it('should contain filter for tritanopia', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#tritanopia');
    expect(filter).toBeInTheDocument();
    expect(filter?.tagName.toLowerCase()).toBe('filter');
  });

  it('should contain filter for tritanomaly', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#tritanomaly');
    expect(filter).toBeInTheDocument();
    expect(filter?.tagName.toLowerCase()).toBe('filter');
  });

  it('should contain filter for achromatopsia', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#achromatopsia');
    expect(filter).toBeInTheDocument();
    expect(filter?.tagName.toLowerCase()).toBe('filter');
  });

  it('should contain filter for achromatomaly', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#achromatomaly');
    expect(filter).toBeInTheDocument();
    expect(filter?.tagName.toLowerCase()).toBe('filter');
  });

  it('should have correct color matrix for protanopia', () => {
    const { container } = render(<ColorblindFilters />);
    const colorMatrix = container.querySelector('#protanopia feColorMatrix');
    expect(colorMatrix).toBeInTheDocument();
    expect(colorMatrix).toHaveAttribute('type', 'matrix');

    const expectedMatrix = matrixToSVGString(
      COLORBLIND_MATRICES[ColorblindType.PROTANOPIA]
    );
    expect(colorMatrix).toHaveAttribute('values', expectedMatrix);
  });

  it('should have correct color matrix for deuteranopia', () => {
    const { container } = render(<ColorblindFilters />);
    const colorMatrix = container.querySelector('#deuteranopia feColorMatrix');
    expect(colorMatrix).toBeInTheDocument();
    expect(colorMatrix).toHaveAttribute('type', 'matrix');

    const expectedMatrix = matrixToSVGString(
      COLORBLIND_MATRICES[ColorblindType.DEUTERANOPIA]
    );
    expect(colorMatrix).toHaveAttribute('values', expectedMatrix);
  });

  it('should have correct color matrix for tritanopia', () => {
    const { container } = render(<ColorblindFilters />);
    const colorMatrix = container.querySelector('#tritanopia feColorMatrix');
    expect(colorMatrix).toBeInTheDocument();
    expect(colorMatrix).toHaveAttribute('type', 'matrix');

    const expectedMatrix = matrixToSVGString(
      COLORBLIND_MATRICES[ColorblindType.TRITANOPIA]
    );
    expect(colorMatrix).toHaveAttribute('values', expectedMatrix);
  });

  it('should have correct color matrix for achromatopsia', () => {
    const { container } = render(<ColorblindFilters />);
    const colorMatrix = container.querySelector('#achromatopsia feColorMatrix');
    expect(colorMatrix).toBeInTheDocument();
    expect(colorMatrix).toHaveAttribute('type', 'matrix');

    const expectedMatrix = matrixToSVGString(
      COLORBLIND_MATRICES[ColorblindType.ACHROMATOPSIA]
    );
    expect(colorMatrix).toHaveAttribute('values', expectedMatrix);
  });

  it('should not have a filter for NONE type', () => {
    const { container } = render(<ColorblindFilters />);
    const filter = container.querySelector('#none');
    expect(filter).not.toBeInTheDocument();
  });

  it('should have all filters with feColorMatrix elements', () => {
    const { container } = render(<ColorblindFilters />);
    const filters = container.querySelectorAll('filter');

    filters.forEach((filter) => {
      const colorMatrix = filter.querySelector('feColorMatrix');
      expect(colorMatrix).toBeInTheDocument();
      expect(colorMatrix).toHaveAttribute('type', 'matrix');
      expect(colorMatrix).toHaveAttribute('values');
    });
  });

  it('should have exactly 8 filters', () => {
    const { container } = render(<ColorblindFilters />);
    const filters = container.querySelectorAll('filter');
    expect(filters).toHaveLength(8); // All types except NONE
  });

  it('should preserve alpha channel in all filters', () => {
    const { container } = render(<ColorblindFilters />);
    const filters = container.querySelectorAll('filter feColorMatrix');

    filters.forEach((colorMatrix) => {
      const values = colorMatrix.getAttribute('values')?.split(' ').map(Number);
      if (values) {
        // Check that the alpha row (4th row) is [0, 0, 0, 1, 0]
        expect(values[15]).toBe(0); // R coefficient
        expect(values[16]).toBe(0); // G coefficient
        expect(values[17]).toBe(0); // B coefficient
        expect(values[18]).toBe(1); // A coefficient
        expect(values[19]).toBe(0); // offset
      }
    });
  });

  // App root placement test removed - tests DOM structure rather than behavior
  // Component placement is verified through integration and visual testing

  it('should not interfere with page layout', () => {
    const { container } = render(<ColorblindFilters />);
    const svg = container.querySelector('svg');

    // SVG should be hidden and not take up space
    expect(svg).toHaveClass('hidden');

    // Should not have display or visibility styles that would make it visible
    const computedStyle = window.getComputedStyle(svg as Element);
    expect(computedStyle.display).not.toBe('block');
  });
});
