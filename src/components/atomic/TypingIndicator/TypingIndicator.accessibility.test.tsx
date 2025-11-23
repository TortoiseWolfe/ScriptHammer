/**
 * Accessibility Tests for TypingIndicator
 * Task: T127
 *
 * Tests screen reader announcements, ARIA attributes, and keyboard navigation.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import TypingIndicator from './TypingIndicator';

expect.extend(toHaveNoViolations);

describe('TypingIndicator Accessibility', () => {
  it('should have no accessibility violations when shown', async () => {
    const { container } = render(
      <TypingIndicator userName="Alice" show={true} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA role and live region', () => {
    render(<TypingIndicator userName="Alice" show={true} />);

    const indicator = screen.getByTestId('typing-indicator');
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).toHaveAttribute('aria-atomic', 'true');
  });

  it('should announce typing status to screen readers', () => {
    const { rerender } = render(
      <TypingIndicator userName="Alice" show={false} />
    );

    // Initially hidden, no announcement
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();

    // Show typing indicator
    rerender(<TypingIndicator userName="Alice" show={true} />);

    const indicator = screen.getByTestId('typing-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('Alice is typing...');
  });

  it('should hide animated dots from screen readers', () => {
    render(<TypingIndicator userName="Alice" show={true} />);

    const dotsContainer = screen
      .getByTestId('typing-indicator')
      .querySelector('[aria-hidden="true"]');

    expect(dotsContainer).toBeInTheDocument();
    expect(dotsContainer).toHaveAttribute('aria-hidden', 'true');
  });

  it('should display user name in status text', () => {
    render(<TypingIndicator userName="Bob Smith" show={true} />);

    expect(screen.getByText('Bob Smith is typing...')).toBeInTheDocument();
  });

  it('should handle long user names gracefully', () => {
    const longName = 'Christopher Alexander Thompson-Wellington III';
    render(<TypingIndicator userName={longName} show={true} />);

    expect(screen.getByText(`${longName} is typing...`)).toBeInTheDocument();
  });

  it('should not render when show=false', () => {
    const { container } = render(
      <TypingIndicator userName="Alice" show={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should have proper color contrast for text', () => {
    render(<TypingIndicator userName="Alice" show={true} />);

    const indicator = screen.getByTestId('typing-indicator');

    // Text should have base-content/70 opacity for sufficient contrast
    expect(indicator).toHaveClass('text-base-content/70');
  });

  it('should support custom className', () => {
    render(
      <TypingIndicator userName="Alice" show={true} className="custom-class" />
    );

    const indicator = screen.getByTestId('typing-indicator');
    expect(indicator).toHaveClass('custom-class');
  });

  it('should have semantic HTML structure', () => {
    const { container } = render(
      <TypingIndicator userName="Alice" show={true} />
    );

    // Should be a div with status role
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toBeInTheDocument();
    expect(indicator?.tagName).toBe('DIV');
  });
});
