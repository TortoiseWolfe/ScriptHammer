/**
 * Unit Tests for ReadReceipt Component
 * Task: T124
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ReadReceipt from './ReadReceipt';

describe('ReadReceipt', () => {
  it('renders single checkmark for sent status', () => {
    const { container } = render(<ReadReceipt status="sent" />);
    expect(screen.getByTestId('read-receipt')).toBeInTheDocument();
    expect(screen.getByLabelText('Message sent')).toBeInTheDocument();

    // Should have gray color
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-base-content/40');
  });

  it('renders double checkmarks for delivered status', () => {
    render(<ReadReceipt status="delivered" />);
    expect(screen.getByLabelText('Message delivered')).toBeInTheDocument();

    // Should have two checkmarks (SVGs)
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders blue double checkmarks for read status', () => {
    const { container } = render(<ReadReceipt status="read" />);
    expect(screen.getByLabelText('Message read')).toBeInTheDocument();

    // Should have blue color
    const svgs = container.querySelectorAll('svg.text-primary');
    expect(svgs.length).toBe(2);
  });

  it('has appropriate ARIA labels for each status', () => {
    const { rerender } = render(<ReadReceipt status="sent" />);
    expect(
      screen.getByRole('img', { name: 'Message sent' })
    ).toBeInTheDocument();

    rerender(<ReadReceipt status="delivered" />);
    expect(
      screen.getByRole('img', { name: 'Message delivered' })
    ).toBeInTheDocument();

    rerender(<ReadReceipt status="read" />);
    expect(
      screen.getByRole('img', { name: 'Message read' })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    const { container } = render(
      <ReadReceipt status="sent" className={customClass} />
    );
    const element = container.querySelector('.custom-test-class');
    expect(element).toBeInTheDocument();
  });

  it('has consistent size across all statuses', () => {
    const { container: sentContainer } = render(<ReadReceipt status="sent" />);
    const { container: deliveredContainer } = render(
      <ReadReceipt status="delivered" />
    );
    const { container: readContainer } = render(<ReadReceipt status="read" />);

    const sentIcon = sentContainer.querySelector(
      '[data-testid="read-receipt"]'
    );
    const deliveredIcon = deliveredContainer.querySelector(
      '[data-testid="read-receipt"]'
    );
    const readIcon = readContainer.querySelector(
      '[data-testid="read-receipt"]'
    );

    // All should use inline-flex
    expect(sentIcon).toHaveClass('inline-flex');
    expect(deliveredIcon).toHaveClass('inline-flex');
    expect(readIcon).toHaveClass('inline-flex');
  });
});
