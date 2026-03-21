import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Pagination from './Pagination';

expect.extend(toHaveNoViolations);

describe('Pagination Accessibility', () => {
  const defaultProps = {
    currentPage: 0,
    totalItems: 100,
    pageSize: 25,
    onPageChange: () => {},
    testId: 'pagination',
  };

  it('has no axe violations on first page', async () => {
    const { container } = render(<Pagination {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations on last page', async () => {
    const { container } = render(
      <Pagination {...defaultProps} currentPage={3} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has aria-label on nav element', () => {
    render(<Pagination {...defaultProps} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute(
      'aria-label',
      'Pagination, page 1 of 4'
    );
  });

  it('has aria-labels on buttons', () => {
    render(<Pagination {...defaultProps} currentPage={1} />);
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
  });
});
