import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BandJingles from './BandJingles';
import { JINGLES } from '@/lib/band/jingles';

expect.extend(toHaveNoViolations);

describe('BandJingles Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<BandJingles />);
    // `no-autoplay-audio` is switched off because axe answers it by loading the
    // media, which jsdom cannot do. The condition is asserted directly below.
    const results = await axe(container, {
      rules: { 'no-autoplay-audio': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('never autoplays and gives every player a label', () => {
    const { container } = render(<BandJingles />);
    const audios = container.querySelectorAll('audio');
    expect(audios).toHaveLength(JINGLES.length);
    for (const audio of audios) {
      expect(audio).not.toHaveAttribute('autoplay');
      expect(audio).toHaveAttribute('controls');
      expect(audio).toHaveAttribute('aria-label');
    }
  });

  it('is a labelled region with one labelled heading per take', () => {
    const { container } = render(<BandJingles />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-labelledby', 'jingles');
    expect(container.querySelector('#jingles')).toHaveTextContent('Jingles');
    const headings = container.querySelectorAll('h3');
    expect(headings).toHaveLength(JINGLES.length);
    headings.forEach((heading) => {
      expect(heading.textContent?.trim()).toBeTruthy();
    });
  });
});
