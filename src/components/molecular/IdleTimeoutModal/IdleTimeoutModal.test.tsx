import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IdleTimeoutModal from './IdleTimeoutModal';

describe('IdleTimeoutModal', () => {
  const defaultProps = {
    isOpen: true,
    timeRemaining: 65, // 1 minute 5 seconds
    onContinue: vi.fn(),
    onSignOut: vi.fn(),
  };

  it('renders when isOpen is true', () => {
    render(<IdleTimeoutModal {...defaultProps} />);
    expect(screen.getByText('Session Timeout Warning')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<IdleTimeoutModal {...defaultProps} isOpen={false} />);
    expect(
      screen.queryByText('Session Timeout Warning')
    ).not.toBeInTheDocument();
  });

  it('displays time remaining correctly', () => {
    render(<IdleTimeoutModal {...defaultProps} timeRemaining={125} />);
    expect(screen.getByRole('timer')).toHaveTextContent('2:05');
  });

  it('calls onContinue when Continue button is clicked', () => {
    render(<IdleTimeoutModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(defaultProps.onContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onSignOut when Sign Out button is clicked', () => {
    render(<IdleTimeoutModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(defaultProps.onSignOut).toHaveBeenCalledTimes(1);
  });

  it('pads seconds with zero when less than 10', () => {
    render(<IdleTimeoutModal {...defaultProps} timeRemaining={9} />);
    expect(screen.getByRole('timer')).toHaveTextContent('0:09');
  });
});
