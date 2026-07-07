import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import TemplateStats from './TemplateStats';

const STATS = [
  {
    value: '32',
    label: 'Themes',
    detail: 'DaisyUI · live switching',
    href: '/themes',
  },
  {
    value: '2,400+',
    label: 'Tests',
    detail: 'Unit · a11y · E2E',
    href: '/status',
  },
  {
    value: 'PWA',
    label: 'Offline-first',
    detail: 'Service worker',
    href: '/docs',
  },
];

const DEMOS = [
  { label: 'Blog', href: '/blog' },
  { label: 'Storybook', href: 'https://example.com/sb/', external: true },
];

describe('TemplateStats Accessibility', () => {
  it('has no axe violations (stats only)', async () => {
    const { container } = render(<TemplateStats stats={STATS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (stats + demos)', async () => {
    const { container } = render(<TemplateStats stats={STATS} demos={DEMOS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('exposes the section with an accessible region label', () => {
    render(<TemplateStats stats={STATS} />);
    expect(
      screen.getByRole('region', { name: 'Template capabilities' })
    ).toBeInTheDocument();
  });

  it('exposes demo links inside a named navigation landmark', () => {
    render(<TemplateStats stats={STATS} demos={DEMOS} />);
    expect(
      screen.getByRole('navigation', { name: 'Live demos' })
    ).toBeInTheDocument();
  });

  it('gives every stat link an accessible name containing the number and label', () => {
    // Screen-reader users hear the link text. The number alone ("32") is
    // meaningless; the label alone ("Themes") loses the claim. Both must be
    // inside the <a> so the accessible name reads "32 Themes DaisyUI…".
    render(<TemplateStats stats={STATS} />);
    const link = screen.getByRole('link', { name: /32[\s\S]*Themes/ });
    expect(link).toBeInTheDocument();
  });

  it('meets the 44px touch-target floor on stat links', () => {
    // WCAG 2.5.5 / mobile-first constraint encoded in CLAUDE.md. min-h-11
    // is 2.75rem == 44px.
    render(<TemplateStats stats={STATS} />);
    const link = screen.getByRole('link', { name: /32[\s\S]*Themes/ });
    expect(link.className).toMatch(/min-h-11/);
  });

  it('meets the 44px touch-target floor on demo links', () => {
    render(<TemplateStats stats={STATS} demos={DEMOS} />);
    const link = screen.getByRole('link', { name: 'Blog' });
    expect(link.className).toMatch(/min-h-11/);
  });
});
