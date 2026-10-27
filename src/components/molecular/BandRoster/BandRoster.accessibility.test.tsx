import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BandRoster from './BandRoster';

expect.extend(toHaveNoViolations);

describe('BandRoster Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<BandRoster />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('is a labelled list with one item per member', () => {
    const { container } = render(<BandRoster />);
    const list = container.querySelector('ul');
    expect(list).toHaveAttribute('aria-label', 'Band members');
    expect(list?.querySelectorAll(':scope > li')).toHaveLength(7);
  });

  it('gives every image alt text', () => {
    const { container } = render(<BandRoster />);
    container.querySelectorAll('img').forEach((img) => {
      expect(img.getAttribute('alt')).toBeTruthy();
    });
  });
});
