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
    // FOOTER_LINKS models the three EXTERNAL brand links only. The tip jar is a
    // fourth, internal link added directly in the component -- deliberately not
    // in that array, which Footer.tsx destructures positionally and whose
    // entries the sibling spec asserts open in a new tab (T051).
    expect(links.length).toBe(FOOTER_LINKS.length + 1);
    for (const link of links) {
      expect((link.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('the tip link is internal — no new tab, no noopener dance', () => {
    // If this ever gains target=_blank it has been moved into FOOTER_LINKS,
    // which would also silently reassign the three positional constants.
    render(<Footer />);
    const tip = screen.getByRole('link', { name: /tip jar/i });
    expect(tip).toHaveAttribute('href', '/tip');
    expect(tip).not.toHaveAttribute('target');
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
