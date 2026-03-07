import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DateRangeFilter from './DateRangeFilter';

describe('DateRangeFilter', () => {
  beforeEach(() => {
    // Freeze "today" so preset math is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders two labeled date inputs', () => {
    render(<DateRangeFilter onChange={vi.fn()} />);
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
  });

  it('reflects controlled value in inputs', () => {
    render(
      <DateRangeFilter
        value={{ start: '2026-02-01', end: '2026-03-01' }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-02-01');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-03-01');
  });

  it('calls onChange when start date input changes', () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        value={{ start: '2026-02-01', end: '2026-03-01' }}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-01-15' },
    });
    expect(onChange).toHaveBeenCalledWith({
      start: '2026-01-15',
      end: '2026-03-01',
    });
  });

  it('calls onChange when end date input changes', () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        value={{ start: '2026-02-01', end: '2026-03-01' }}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-03-15' },
    });
    expect(onChange).toHaveBeenCalledWith({
      start: '2026-02-01',
      end: '2026-03-15',
    });
  });

  it('renders preset buttons', () => {
    render(<DateRangeFilter onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });

  it('emits last-7-days range when 7d preset is clicked', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '7d' }));
    // 2026-03-05 minus 7 days = 2026-02-26
    expect(onChange).toHaveBeenCalledWith({
      start: '2026-02-26',
      end: '2026-03-05',
    });
  });

  it('emits last-30-days range when 30d preset is clicked', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '30d' }));
    // 2026-03-05 minus 30 days = 2026-02-03
    expect(onChange).toHaveBeenCalledWith({
      start: '2026-02-03',
      end: '2026-03-05',
    });
  });

  it('emits last-90-days range when 90d preset is clicked', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '90d' }));
    // 2026-03-05 minus 90 days = 2025-12-05
    expect(onChange).toHaveBeenCalledWith({
      start: '2025-12-05',
      end: '2026-03-05',
    });
  });

  it('constrains end input min to start value', () => {
    render(
      <DateRangeFilter
        value={{ start: '2026-02-01', end: '2026-03-01' }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('End date')).toHaveAttribute(
      'min',
      '2026-02-01'
    );
  });

  it('constrains start input max to end value', () => {
    render(
      <DateRangeFilter
        value={{ start: '2026-02-01', end: '2026-03-01' }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Start date')).toHaveAttribute(
      'max',
      '2026-03-01'
    );
  });

  it('applies custom className', () => {
    const { container } = render(
      <DateRangeFilter onChange={vi.fn()} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('sets testId on root', () => {
    render(<DateRangeFilter onChange={vi.fn()} testId="range-filter" />);
    expect(screen.getByTestId('range-filter')).toBeInTheDocument();
  });
});
