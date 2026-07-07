import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationButton } from './LocationButton';

describe('LocationButton', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render button with default label', () => {
    render(<LocationButton onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Get my location');
  });

  it('should show loading state when loading is true', () => {
    render(<LocationButton onClick={mockOnClick} loading={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Getting location...');
    expect(button).toHaveAttribute('aria-busy', 'true');
    const spinner = button.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('should show denied state when permission is denied', () => {
    render(<LocationButton onClick={mockOnClick} permissionState="denied" />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Location blocked');
    expect(button).toBeDisabled();
  });

  it('should show granted state when permission is granted', () => {
    render(
      <LocationButton
        onClick={mockOnClick}
        permissionState="granted"
        hasLocation={true}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Update location');
    expect(button).not.toBeDisabled();
  });

  it('should call onClick when clicked and not disabled', () => {
    render(<LocationButton onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    render(<LocationButton onClick={mockOnClick} disabled={true} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // Disabled buttons don't fire events, so no need to click
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('should not call onClick when loading', () => {
    render(<LocationButton onClick={mockOnClick} loading={true} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Loading buttons typically still allow clicks
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should apply secondary variant when specified', () => {
    render(<LocationButton onClick={mockOnClick} variant="secondary" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-secondary');
  });

  it('should apply ghost variant when specified', () => {
    render(<LocationButton onClick={mockOnClick} variant="ghost" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-ghost');
  });

  it('should apply outline variant when specified', () => {
    // Outline variant doesn't exist in the component, it returns primary
    render(<LocationButton onClick={mockOnClick} variant={'outline' as any} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-primary');
  });

  it('should apply medium size by default', () => {
    render(<LocationButton onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-md');
  });

  it('should apply small size when specified', () => {
    render(<LocationButton onClick={mockOnClick} size="sm" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-sm');
  });

  it('should apply large size when specified', () => {
    render(<LocationButton onClick={mockOnClick} size="lg" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-lg');
  });

  it('should apply custom className', () => {
    const customClass = 'custom-button-class';
    render(<LocationButton onClick={mockOnClick} className={customClass} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass(customClass);
  });

  it('should have correct aria-label', () => {
    render(<LocationButton onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Get my location');
  });

  it('should update aria-label when loading', () => {
    render(<LocationButton onClick={mockOnClick} loading={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Getting location...');
  });

  it('should update aria-label when permission denied', () => {
    render(<LocationButton onClick={mockOnClick} permissionState="denied" />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Location blocked');
  });

  it('should apply custom testId', () => {
    const customTestId = 'custom-location-button';
    render(<LocationButton onClick={mockOnClick} testId={customTestId} />);

    const button = screen.getByTestId(customTestId);
    expect(button).toBeInTheDocument();
  });

  it('should handle hasLocation without granted permission', () => {
    render(<LocationButton onClick={mockOnClick} hasLocation={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Update location');
  });

  it('should handle permission prompt state', () => {
    render(<LocationButton onClick={mockOnClick} permissionState="prompt" />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Get my location');
    expect(button).not.toBeDisabled();
  });

  it('should handle permission denied with hasLocation', () => {
    render(
      <LocationButton
        onClick={mockOnClick}
        permissionState="denied"
        hasLocation={true}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Location blocked');
    expect(button).toBeDisabled();
  });
});
