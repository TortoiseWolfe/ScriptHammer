import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 0,
    totalItems: 100,
    pageSize: 25,
    onPageChange: vi.fn(),
    testId: 'pagination',
  };

  it('renders page indicator', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByTestId('pagination-indicator')).toHaveTextContent(
      'Page 1 of 4'
    );
  });

  it('disables Previous on first page', () => {
    render(<Pagination {...defaultProps} currentPage={0} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();
  });

  it('disables Next on last page', () => {
    render(<Pagination {...defaultProps} currentPage={3} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
  });

  it('calls onPageChange with correct page on Next click', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination {...defaultProps} currentPage={1} onPageChange={onPageChange} />
    );
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with correct page on Previous click', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination {...defaultProps} currentPage={2} onPageChange={onPageChange} />
    );
    await userEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('hides when all items fit on one page', () => {
    const { container } = render(
      <Pagination {...defaultProps} totalItems={20} pageSize={25} />
    );
    expect(container.querySelector('nav')).toBeNull();
  });

  it('hides when totalItems is zero', () => {
    const { container } = render(
      <Pagination {...defaultProps} totalItems={0} />
    );
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders correct page on middle page', () => {
    render(<Pagination {...defaultProps} currentPage={2} />);
    expect(screen.getByTestId('pagination-indicator')).toHaveTextContent(
      'Page 3 of 4'
    );
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();
  });
});
