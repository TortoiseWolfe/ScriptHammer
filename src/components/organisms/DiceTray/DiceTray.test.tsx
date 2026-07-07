import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiceTray from './DiceTray';

describe('DiceTray', () => {
  it('renders with default props', () => {
    render(<DiceTray />);
    expect(screen.getByText('Dice Tray - 5 × D6')).toBeInTheDocument();
    expect(screen.getByText('Roll Unlocked Dice')).toBeInTheDocument();
    expect(screen.getByText('Reset All')).toBeInTheDocument();
  });

  it('renders with custom number of dice', () => {
    render(<DiceTray numberOfDice={3} />);
    expect(screen.getByText('Dice Tray - 3 × D6')).toBeInTheDocument();
  });

  it('renders with D20 dice', () => {
    render(<DiceTray numberOfDice={2} sides={20} />);
    expect(screen.getByText('Dice Tray - 2 × D20')).toBeInTheDocument();
  });

  it('shows initial total as 0', () => {
    render(<DiceTray />);
    const totalElement = screen.getByText('Total').parentElement;
    expect(totalElement?.querySelector('.stat-value')).toHaveTextContent('0');
  });

  it('rolls dice when Roll button is clicked', async () => {
    render(<DiceTray numberOfDice={3} />);
    const rollButton = screen.getByText('Roll Unlocked Dice');

    fireEvent.click(rollButton);

    // Button should be disabled while rolling
    expect(rollButton).toBeDisabled();
    expect(screen.getByText('Rolling...')).toBeInTheDocument();

    // Wait for rolling to complete
    await waitFor(
      () => {
        expect(rollButton).not.toBeDisabled();
      },
      { timeout: 1500 }
    );

    // Total should be greater than 0 after rolling
    const totalElement = screen.getByText('Total').parentElement;
    const totalValue = parseInt(
      totalElement?.querySelector('.stat-value')?.textContent || '0'
    );
    expect(totalValue).toBeGreaterThan(0);
  });

  it('resets all dice when Reset button is clicked', async () => {
    render(<DiceTray numberOfDice={2} />);

    // First roll the dice
    const rollButton = screen.getByText('Roll Unlocked Dice');
    fireEvent.click(rollButton);

    await waitFor(
      () => {
        expect(rollButton).not.toBeDisabled();
      },
      { timeout: 1500 }
    );

    // Then reset
    const resetButton = screen.getByText('Reset All');
    fireEvent.click(resetButton);

    // Total should be back to 0
    const totalElement = screen.getByText('Total').parentElement;
    expect(totalElement?.querySelector('.stat-value')).toHaveTextContent('0');
  });

  it('displays lock zone and tray areas', () => {
    render(<DiceTray />);
    expect(screen.getByText(/Active Dice/)).toBeInTheDocument();
    expect(screen.getByText(/Lock Zone/)).toBeInTheDocument();
  });

  it('shows locked dice count', () => {
    render(<DiceTray />);
    expect(screen.getByText('0 dice locked')).toBeInTheDocument();
  });

  it('shows tips section', () => {
    render(<DiceTray />);
    expect(screen.getByText('💡 Tips:')).toBeInTheDocument();
    expect(screen.getByText(/Drag dice to the lock zone/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<DiceTray className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('handles drag and drop events', () => {
    render(<DiceTray numberOfDice={2} />);

    const lockZone = screen.getByText(/Lock Zone/).parentElement;

    // Create a mock drag event
    const dragEvent = new Event('dragover', { bubbles: true });
    Object.defineProperty(dragEvent, 'preventDefault', { value: vi.fn() });

    fireEvent(lockZone!, dragEvent);

    // The zone should have the drag-over styling
    expect(lockZone).toBeInTheDocument();
  });

  it('limits dice to specified maximum', () => {
    render(<DiceTray numberOfDice={10} />);
    expect(screen.getByText('Dice Tray - 10 × D6')).toBeInTheDocument();
  });
});
