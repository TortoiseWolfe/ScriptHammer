import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Loader from './Loader';

describe('Loader', () => {
  it('renders without crashing', () => {
    const { container } = render(<Loader />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('exposes status role for screen readers', () => {
    render(<Loader />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the "Loading 3D scene..." text', () => {
    render(<Loader />);
    expect(screen.getByText(/loading 3d scene/i)).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(<Loader className="custom-test-class" />);
    const element = container.querySelector('.custom-test-class');
    expect(element).toBeInTheDocument();
  });
});
