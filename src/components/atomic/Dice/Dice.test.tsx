import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dice from './Dice';

describe('Dice', () => {
  it('renders D6 dice by default', () => {
    render(<Dice />);
    expect(screen.getByText('D6 Dice')).toBeInTheDocument();
    expect(screen.getByText('Roll D6')).toBeInTheDocument();
  });

  it('renders D20 dice when specified', () => {
    render(<Dice sides={20} />);
    expect(screen.getByText('D20 Dice')).toBeInTheDocument();
    expect(screen.getByText('Roll D20')).toBeInTheDocument();
  });

  it('shows initial state with question mark', () => {
    render(<Dice />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('rolls dice when button is clicked', async () => {
    render(<Dice sides={6} />);
    const button = screen.getByRole('button', { name: /Roll 6-sided dice/i });

    fireEvent.click(button);

    // Button should be disabled while rolling
    expect(button).toBeDisabled();
    expect(screen.getByText('Rolling...')).toBeInTheDocument();

    // Wait for rolling to complete
    await waitFor(
      () => {
        expect(button).not.toBeDisabled();
      },
      { timeout: 1500 }
    );

    // Check that a result is shown
    expect(screen.getByText('Result')).toBeInTheDocument();
  });

  it('shows dice face icons for D6', async () => {
    render(<Dice sides={6} />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    await waitFor(
      () => {
        expect(button).not.toBeDisabled();
      },
      { timeout: 1500 }
    );

    // Should show one of the dice face Unicode characters
    const diceIcon = screen.getByText(/[⚀⚁⚂⚃⚄⚅]/);
    expect(diceIcon).toBeInTheDocument();
  });

  it('shows number for D20', async () => {
    render(<Dice sides={20} />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    await waitFor(
      () => {
        expect(button).not.toBeDisabled();
      },
      { timeout: 1500 }
    );

    // Should show a number between 1 and 20
    const statValue = screen
      .getByText('Result')
      .parentElement?.querySelector('.stat-value');
    const value = parseInt(statValue?.textContent || '0');
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(20);
  });

  it('shows critical message for max roll', async () => {
    render(<Dice sides={6} />);

    // Mock Math.random to always return max value
    const originalRandom = Math.random;
    Math.random = vi.fn(() => 0.99);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(
      () => {
        expect(button).not.toBeDisabled();
      },
      { timeout: 1500 }
    );

    expect(screen.getByText('Critical!')).toBeInTheDocument();

    // Restore original Math.random
    Math.random = originalRandom;
  });

  it('shows critical fail message for roll of 1', async () => {
    render(<Dice sides={6} />);

    // Mock Math.random to always return min value
    const originalRandom = Math.random;
    Math.random = vi.fn(() => 0);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(
      () => {
        expect(button).not.toBeDisabled();
      },
      { timeout: 1500 }
    );

    expect(screen.getByText('Critical Fail!')).toBeInTheDocument();

    // Restore original Math.random
    Math.random = originalRandom;
  });

  it('applies custom className', () => {
    const { container } = render(<Dice className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<Dice sides={6} />);

    // Check button aria-label
    expect(screen.getByLabelText('Roll 6-sided dice')).toBeInTheDocument();

    // Check dice display text for screen readers
    expect(screen.getByText('Dice not rolled yet')).toBeInTheDocument();
  });
});
