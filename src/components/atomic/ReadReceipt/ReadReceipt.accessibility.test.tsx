/**
 * Accessibility Tests for ReadReceipt
 * Task: T128
 *
 * Tests ARIA labels, alt text, and semantic HTML for delivery status indicators.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ReadReceipt from './ReadReceipt';

expect.extend(toHaveNoViolations);

describe('ReadReceipt Accessibility', () => {
  it('should have no accessibility violations for sent status', async () => {
    const { container } = render(<ReadReceipt status="sent" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations for delivered status', async () => {
    const { container } = render(<ReadReceipt status="delivered" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations for read status', async () => {
    const { container } = render(<ReadReceipt status="read" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA role and label for sent status', () => {
    render(<ReadReceipt status="sent" />);

    const receipt = screen.getByTestId('read-receipt');
    expect(receipt).toHaveAttribute('role', 'img');
    expect(receipt).toHaveAttribute('aria-label', 'Message sent');
  });

  it('should have proper ARIA role and label for delivered status', () => {
    render(<ReadReceipt status="delivered" />);

    const receipt = screen.getByTestId('read-receipt');
    expect(receipt).toHaveAttribute('role', 'img');
    expect(receipt).toHaveAttribute('aria-label', 'Message delivered');
  });

  it('should have proper ARIA role and label for read status', () => {
    render(<ReadReceipt status="read" />);

    const receipt = screen.getByTestId('read-receipt');
    expect(receipt).toHaveAttribute('role', 'img');
    expect(receipt).toHaveAttribute('aria-label', 'Message read');
  });

  it('should have aria-label on SVG icons for sent status', () => {
    render(<ReadReceipt status="sent" />);

    const svg = screen.getByLabelText('Message sent');
    expect(svg).toBeInTheDocument();
  });

  it('should have aria-label on SVG icons for delivered status', () => {
    render(<ReadReceipt status="delivered" />);

    const wrapper = screen.getByLabelText('Message delivered');
    expect(wrapper).toBeInTheDocument();
  });

  it('should have aria-label on SVG icons for read status', () => {
    render(<ReadReceipt status="read" />);

    const wrapper = screen.getByLabelText('Message read');
    expect(wrapper).toBeInTheDocument();
  });

  it('should support custom className', () => {
    render(<ReadReceipt status="sent" className="custom-class" />);

    const receipt = screen.getByTestId('read-receipt');
    expect(receipt).toHaveClass('custom-class');
  });

  it('should have proper color contrast for sent status (gray)', () => {
    render(<ReadReceipt status="sent" />);

    const svg = screen.getByTestId('read-receipt').querySelector('svg');
    expect(svg).toHaveClass('text-base-content/40');
  });

  it('should have proper color contrast for delivered status (gray)', () => {
    render(<ReadReceipt status="delivered" />);

    const svgs = screen.getByTestId('read-receipt').querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveClass('text-base-content/40');
    });
  });

  it('should have proper color contrast for read status (primary blue)', () => {
    render(<ReadReceipt status="read" />);

    const svgs = screen.getByTestId('read-receipt').querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveClass('text-primary');
    });
  });

  it('should render single checkmark for sent status', () => {
    const { container } = render(<ReadReceipt status="sent" />);

    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
  });

  it('should render double checkmarks for delivered status', () => {
    const { container } = render(<ReadReceipt status="delivered" />);

    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
  });

  it('should render double checkmarks for read status', () => {
    const { container } = render(<ReadReceipt status="read" />);

    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
  });

  it('should have semantic HTML structure', () => {
    const { container } = render(<ReadReceipt status="sent" />);

    // Should be a div with img role
    const receipt = container.querySelector('[role="img"]');
    expect(receipt).toBeInTheDocument();
    expect(receipt?.tagName).toBe('DIV');
  });

  it('should have proper checkmark path for all statuses', () => {
    const { container: sentContainer } = render(<ReadReceipt status="sent" />);
    const { container: deliveredContainer } = render(
      <ReadReceipt status="delivered" />
    );
    const { container: readContainer } = render(<ReadReceipt status="read" />);

    // All should have checkmark path (M5 13l4 4L19 7)
    const checkmarkPath = 'M5 13l4 4L19 7';

    [sentContainer, deliveredContainer, readContainer].forEach((container) => {
      const path = container.querySelector('path');
      expect(path).toHaveAttribute('d', checkmarkPath);
    });
  });

  it('should differentiate between statuses for screen readers', () => {
    const { rerender } = render(<ReadReceipt status="sent" />);
    expect(screen.getByLabelText('Message sent')).toBeInTheDocument();

    rerender(<ReadReceipt status="delivered" />);
    expect(screen.getByLabelText('Message delivered')).toBeInTheDocument();

    rerender(<ReadReceipt status="read" />);
    expect(screen.getByLabelText('Message read')).toBeInTheDocument();
  });
});
