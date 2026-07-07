import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FallbackPanel from './FallbackPanel';

describe('FallbackPanel', () => {
  it('renders without crashing', () => {
    const { container } = render(<FallbackPanel />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders the "3D Content Unavailable" headline', () => {
    render(<FallbackPanel />);
    expect(screen.getByText(/3d content unavailable/i)).toBeInTheDocument();
  });

  it('renders a Retry button with the correct accessible label', () => {
    render(<FallbackPanel />);
    const retry = screen.getByRole('button', {
      name: /retry rendering 3d scene/i,
    });
    expect(retry).toBeInTheDocument();
  });

  it('calls onRetry callback when the Retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<FallbackPanel onRetry={onRetry} />);
    fireEvent.click(
      screen.getByRole('button', { name: /retry rendering 3d scene/i })
    );
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders a themed brand-asset silhouette (FR-008)', () => {
    const { container } = render(<FallbackPanel />);
    // Themed silhouette is an inline SVG. Verify the SVG is present and
    // has an aria-hidden attribute (decorative, not announced by screen
    // readers — the headline + body copy carry the meaning).
    const svg = container.querySelector('svg[data-testid="brand-silhouette"]');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('explanatory body copy names WebGL as the requirement (FR-008)', () => {
    render(<FallbackPanel />);
    expect(screen.getByText(/webgl/i)).toBeInTheDocument();
  });
});
