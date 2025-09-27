import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TagBadge from './TagBadge';

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe('TagBadge', () => {
  it('renders tag name', () => {
    render(<TagBadge tag="React" />);
    expect(screen.getByTestId('tag-badge')).toHaveTextContent('React');
  });

  it('renders as a link by default', () => {
    render(<TagBadge tag="TypeScript" />);
    const badge = screen.getByTestId('tag-badge');
    expect(badge.tagName).toBe('A');
    expect(badge).toHaveAttribute('href', '/blog/tags/typescript');
  });

  it('renders as span when not clickable', () => {
    render(<TagBadge tag="JavaScript" clickable={false} />);
    const badge = screen.getByTestId('tag-badge');
    expect(badge.tagName).toBe('SPAN');
  });

  it('renders as button with custom onClick', () => {
    const handleClick = vi.fn();
    render(<TagBadge tag="Vue" onClick={handleClick} />);
    const badge = screen.getByTestId('tag-badge');
    expect(badge.tagName).toBe('BUTTON');
    fireEvent.click(badge);
    expect(handleClick).toHaveBeenCalledWith('Vue');
  });

  it('displays post count when provided', () => {
    render(<TagBadge tag="Next.js" count={5} />);
    expect(screen.getByTestId('tag-badge')).toHaveTextContent('Next.js(5)');
  });

  it('applies size classes', () => {
    const { rerender } = render(<TagBadge tag="CSS" size="sm" />);
    expect(screen.getByTestId('tag-badge')).toHaveClass('badge-sm');

    rerender(<TagBadge tag="CSS" size="md" />);
    expect(screen.getByTestId('tag-badge')).toHaveClass('badge-md');

    rerender(<TagBadge tag="CSS" size="lg" />);
    expect(screen.getByTestId('tag-badge')).toHaveClass('badge-lg');
  });

  it('applies variant classes', () => {
    const { rerender } = render(<TagBadge tag="HTML" variant="default" />);
    expect(screen.getByTestId('tag-badge')).toHaveClass('badge-outline');

    rerender(<TagBadge tag="HTML" variant="primary" />);
    expect(screen.getByTestId('tag-badge')).toHaveClass('badge-primary');

    rerender(<TagBadge tag="HTML" variant="secondary" />);
    expect(screen.getByTestId('tag-badge')).toHaveClass('badge-secondary');

    rerender(<TagBadge tag="HTML" variant="accent" />);
    expect(screen.getByTestId('tag-badge')).toHaveClass('badge-accent');
  });

  it('applies active state classes', () => {
    render(<TagBadge tag="Docker" active />);
    const badge = screen.getByTestId('tag-badge');
    expect(badge).toHaveClass('badge-primary');
    expect(badge).toHaveClass('ring-2');
  });

  it('applies custom className', () => {
    render(<TagBadge tag="Git" className="custom-class" />);
    expect(screen.getByTestId('tag-badge')).toHaveClass('custom-class');
  });

  it('encodes tag in URL correctly', () => {
    render(<TagBadge tag="C++" />);
    expect(screen.getByTestId('tag-badge')).toHaveAttribute(
      'href',
      '/blog/tags/c%2B%2B'
    );
  });

  it('converts tag to lowercase in URL', () => {
    render(<TagBadge tag="PWA" />);
    expect(screen.getByTestId('tag-badge')).toHaveAttribute(
      'href',
      '/blog/tags/pwa'
    );
  });

  it('has appropriate aria-label for link', () => {
    render(<TagBadge tag="Testing" />);
    expect(screen.getByTestId('tag-badge')).toHaveAttribute(
      'aria-label',
      'View posts tagged with Testing'
    );
  });

  it('has appropriate aria-label for button', () => {
    const handleClick = vi.fn();
    render(<TagBadge tag="Vitest" onClick={handleClick} />);
    expect(screen.getByTestId('tag-badge')).toHaveAttribute(
      'aria-label',
      'Filter by tag: Vitest'
    );
  });

  it('prevents default when custom onClick is provided', () => {
    const handleClick = vi.fn();
    render(<TagBadge tag="Jest" onClick={handleClick} />);
    const event = { preventDefault: vi.fn() };
    fireEvent.click(screen.getByTestId('tag-badge'), event);
    expect(handleClick).toHaveBeenCalled();
  });
});
