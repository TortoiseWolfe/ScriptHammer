import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LocationButton } from './LocationButton';

expect.extend(toHaveNoViolations);

describe('LocationButton Accessibility', () => {
  const mockOnClick = vi.fn();

  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<LocationButton onClick={mockOnClick} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    render(<LocationButton onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Get my location');
    expect(button).toHaveAttribute('aria-busy', 'false');
  });

  it('should have no violations when loading', async () => {
    const { container } = render(
      <LocationButton onClick={mockOnClick} loading={true} />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-label', 'Getting location...');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when disabled', async () => {
    const { container } = render(
      <LocationButton onClick={mockOnClick} disabled={true} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when permission denied', async () => {
    const { container } = render(
      <LocationButton onClick={mockOnClick} permissionState="denied" />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-label', 'Location blocked');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard accessible', () => {
    render(<LocationButton onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('tabindex', '-1');
    expect(button).toBeInTheDocument();
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<LocationButton onClick={mockOnClick} />);
    // Note: axe will check color contrast
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have accessible loading indicator', () => {
    render(<LocationButton onClick={mockOnClick} loading={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');

    // Loading spinner should be properly announced
    const spinner = button.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });
});
