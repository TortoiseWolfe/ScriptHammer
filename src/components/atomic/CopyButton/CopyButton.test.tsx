import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from './CopyButton';
import '@testing-library/jest-dom';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('CopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  it('renders with default copy text', () => {
    render(<CopyButton content="test content" />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('copies content to clipboard on click', async () => {
    render(<CopyButton content="test content" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test content');
    });
  });

  it('shows success state after copying', async () => {
    render(<CopyButton content="test content" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('calls onCopySuccess callback', async () => {
    const onCopySuccess = vi.fn();
    render(<CopyButton content="test content" onCopySuccess={onCopySuccess} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onCopySuccess).toHaveBeenCalled();
    });
  });

  it('handles copy failure', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('Copy failed'));
    const onCopyError = vi.fn();

    render(<CopyButton content="test content" onCopyError={onCopyError} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(onCopyError).toHaveBeenCalled();
    });
  });

  it('applies custom className', () => {
    render(<CopyButton content="test content" className="custom-class" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('disables button during animation', async () => {
    render(<CopyButton content="test content" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it('has proper aria-label', () => {
    render(<CopyButton content="test content" />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Copy code to clipboard');
  });

  it('updates aria-label on success', async () => {
    render(<CopyButton content="test content" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Copied!');
    });
  });

  it('handles missing clipboard API gracefully', async () => {
    const originalClipboard = navigator.clipboard;
    Object.assign(navigator, { clipboard: undefined });

    const onCopyError = vi.fn();
    render(<CopyButton content="test content" onCopyError={onCopyError} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onCopyError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Clipboard API not available',
        })
      );
    });

    // Restore clipboard
    Object.assign(navigator, { clipboard: originalClipboard });
  });
});
