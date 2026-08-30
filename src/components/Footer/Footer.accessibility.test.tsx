import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Footer } from './Footer';
import { FOOTER_LINKS } from '@/config/footer-links';

expect.extend(toHaveNoViolations);

describe('Footer Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<Footer />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a contentinfo landmark, so a screen reader can jump to it', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('gives every link a non-empty accessible name', () => {
    // An icon-only or empty link passes axe's colour rules and is still unusable.
    render(<Footer />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(FOOTER_LINKS.length);
    for (const link of links) {
      expect((link.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps the two primary links at the 44px touch target', () => {
    // jsdom has no layout, so this asserts the utility classes that produce the height —
    // the same approach the mobile-touch-targets E2E sweep verifies for real.
    render(<Footer />);
    const primary = FOOTER_LINKS.slice(0, 2).map((l) =>
      screen.getByRole('link', { name: l.label })
    );
    for (const link of primary) {
      expect(link.className).toMatch(/min-h-11/);
    }
  });
});
