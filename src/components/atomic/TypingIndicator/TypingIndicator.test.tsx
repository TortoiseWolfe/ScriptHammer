/**
 * Unit Tests for TypingIndicator Component
 * Task: T123
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TypingIndicator from './TypingIndicator';

describe('TypingIndicator', () => {
  it('renders nothing when show=false', () => {
    const { container } = render(<TypingIndicator show={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders typing indicator when show=true', () => {
    render(<TypingIndicator show={true} userName="Alice" />);
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
  });

  it('displays correct user name in typing text', () => {
    render(<TypingIndicator show={true} userName="Bob" />);
    expect(screen.getByText('Bob is typing...')).toBeInTheDocument();
  });

  it('uses default userName when not provided', () => {
    render(<TypingIndicator show={true} />);
    expect(screen.getByText('User is typing...')).toBeInTheDocument();
  });

  it('has ARIA live region for accessibility', () => {
    render(<TypingIndicator show={true} userName="Charlie" />);
    const indicator = screen.getByTestId('typing-indicator');
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders three animated dots', () => {
    const { container } = render(
      <TypingIndicator show={true} userName="Alice" />
    );
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    const { container } = render(
      <TypingIndicator show={true} className={customClass} />
    );
    const element = container.querySelector('.custom-test-class');
    expect(element).toBeInTheDocument();
  });

  it('hides dots from screen readers with aria-hidden', () => {
    const { container } = render(
      <TypingIndicator show={true} userName="Alice" />
    );
    const dotsContainer = container.querySelector('[aria-hidden="true"]');
    expect(dotsContainer).toBeInTheDocument();
  });
});
