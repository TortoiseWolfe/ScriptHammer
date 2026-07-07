import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SetupCompleteToast from './SetupCompleteToast';

describe('SetupCompleteToast', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when sessionStorage flag is not set', () => {
    const { container } = render(<SetupCompleteToast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when flag is set to a non-true value', () => {
    sessionStorage.setItem('messaging_setup_complete', 'false');
    const { container } = render(<SetupCompleteToast />);
    expect(container.firstChild).toBeNull();
  });

  it('shows toast when sessionStorage flag is true', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    render(<SetupCompleteToast />);
    expect(screen.getByTestId('setup-complete-toast')).toBeInTheDocument();
    expect(screen.getByText('Encryption set up!')).toBeInTheDocument();
  });

  it('clears the sessionStorage flag on mount (one-shot)', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    render(<SetupCompleteToast />);
    expect(sessionStorage.getItem('messaging_setup_complete')).toBeNull();
  });

  it('auto-dismisses after 10 seconds', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    render(<SetupCompleteToast />);
    expect(screen.getByTestId('setup-complete-toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(
      screen.queryByTestId('setup-complete-toast')
    ).not.toBeInTheDocument();
  });

  it('dismisses when Dismiss button is clicked', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    render(<SetupCompleteToast />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(
      screen.queryByTestId('setup-complete-toast')
    ).not.toBeInTheDocument();
  });

  it('clears timeout on unmount', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    const { unmount } = render(<SetupCompleteToast />);
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    render(<SetupCompleteToast className="custom-cls" />);
    expect(screen.getByTestId('setup-complete-toast').className).toContain(
      'custom-cls'
    );
  });
});
