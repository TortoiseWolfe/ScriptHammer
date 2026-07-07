import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
];

const DEMOS = [
  { label: 'Blog', href: '/blog' },
  {
    label: 'Storybook',
    href: 'https://example.com/storybook/',
    external: true,
  },
];

describe('TemplateStats', () => {
  it('renders one link per stat', () => {
    render(<TemplateStats stats={STATS} />);
    expect(
      screen.getByRole('link', { name: /32[\s\S]*Themes/ })
    ).toHaveAttribute('href', '/themes');
    expect(
      screen.getByRole('link', { name: /2,400\+[\s\S]*Tests/ })
    ).toHaveAttribute('href', '/status');
  });

  it('renders stat detail text', () => {
    render(<TemplateStats stats={STATS} />);
    expect(screen.getByText('DaisyUI · live switching')).toBeInTheDocument();
    expect(screen.getByText('Unit · a11y · E2E')).toBeInTheDocument();
  });

  it('renders stat values in monospace', () => {
    // Monospace signals "data, not marketing" — it's a deliberate design
    // constraint, so encode it as a test.
    render(<TemplateStats stats={STATS} />);
    const value = screen.getByText('32');
    expect(value).toHaveClass('font-mono');
  });

  it('omits demo nav entirely when demos prop is absent', () => {
    render(<TemplateStats stats={STATS} />);
    expect(
      screen.queryByRole('navigation', { name: 'Live demos' })
    ).not.toBeInTheDocument();
  });

  it('omits demo nav when demos is an empty array', () => {
    render(<TemplateStats stats={STATS} demos={[]} />);
    expect(
      screen.queryByRole('navigation', { name: 'Live demos' })
    ).not.toBeInTheDocument();
  });

  it('renders demo nav with accessible label when demos provided', () => {
    render(<TemplateStats stats={STATS} demos={DEMOS} />);
    const nav = screen.getByRole('navigation', { name: 'Live demos' });
    expect(within(nav).getByRole('link', { name: 'Blog' })).toHaveAttribute(
      'href',
      '/blog'
    );
  });

  it('opens external demos in a new tab with rel guard', () => {
    // noopener+noreferrer prevents the opened page from reading window.opener
    // — standard tab-nabbing defence for any user-supplied external link.
    render(<TemplateStats stats={STATS} demos={DEMOS} />);
    const ext = screen.getByRole('link', { name: 'Storybook' });
    expect(ext).toHaveAttribute('target', '_blank');
    expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders internal demos without target attribute', () => {
    render(<TemplateStats stats={STATS} demos={DEMOS} />);
    const internal = screen.getByRole('link', { name: 'Blog' });
    expect(internal).not.toHaveAttribute('target');
  });

  it('accepts custom className on the outer wrapper', () => {
    const { container } = render(
      <TemplateStats stats={STATS} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
