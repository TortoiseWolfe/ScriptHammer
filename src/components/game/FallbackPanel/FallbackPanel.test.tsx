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
});
