import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from './Footer';
import { FOOTER_LINKS } from '@/config/footer-links';

describe('Footer', () => {
  it('renders a contentinfo landmark', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('keeps the data-site-footer hook the twin routes depend on', () => {
    // globals.css hides THIS footer on /twins so the compact strip can replace it (#301).
    // The attribute is deliberate — a `footer` tag selector would also catch the strip's own.
    const { container } = render(<Footer />);
    expect(
      container.querySelector('footer[data-site-footer]')
    ).toBeInTheDocument();
  });

  it('renders every configured link, derived from the config not hardcoded', () => {
    // Hardcoding the three labels would make this test pass while the footer showed
    // something else entirely after a rebrand — the #983 lesson, one file over.
    render(<Footer />);
    for (const link of FOOTER_LINKS) {
      const anchor = screen.getByRole('link', { name: link.label });
      expect(anchor).toHaveAttribute('href', link.href);
    }
  });

  it('opens external links safely', () => {
    render(<Footer />);
    for (const link of FOOTER_LINKS) {
      const anchor = screen.getByRole('link', { name: link.label });
      expect(anchor).toHaveAttribute('target', '_blank');
      expect(anchor.getAttribute('rel') ?? '').toMatch(/noopener/);
    }
  });
});
