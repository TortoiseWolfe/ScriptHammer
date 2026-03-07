import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangePicker } from './DateRangePicker';

describe('DateRangePicker', () => {
  it('renders both date inputs with current values', () => {
    render(
      <DateRangePicker
        value={{
          from: new Date('2025-06-01T00:00:00Z'),
          to: new Date('2025-06-30T00:00:00Z'),
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/from/i)).toHaveValue('2025-06-01');
    expect(screen.getByLabelText(/to/i)).toHaveValue('2025-06-30');
  });

  it('renders empty inputs when range is null', () => {
    render(
      <DateRangePicker value={{ from: null, to: null }} onChange={vi.fn()} />
    );
    expect(screen.getByLabelText(/from/i)).toHaveValue('');
    expect(screen.getByLabelText(/to/i)).toHaveValue('');
  });

  it('fires onChange with updated from-date when from input changes', () => {
    const onChange = vi.fn();
    const to = new Date('2025-06-30T00:00:00Z');
    render(<DateRangePicker value={{ from: null, to }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/from/i), {
      target: { value: '2025-06-01' },
    });

    expect(onChange).toHaveBeenCalledOnce();
    const [arg] = onChange.mock.calls[0];
    expect(arg.to).toBe(to);
    // Date input gives local midnight; we only care the day is right.
    expect(arg.from).toBeInstanceOf(Date);
    expect(arg.from.toISOString().slice(0, 10)).toBe('2025-06-01');
  });

  it('fires onChange with null from when from input is cleared', () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{ from: new Date('2025-06-01'), to: null }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/from/i), {
      target: { value: '' },
    });

    expect(onChange).toHaveBeenCalledWith({ from: null, to: null });
  });

  it('renders preset buttons (7d, 30d, 90d)', () => {
    render(
      <DateRangePicker value={{ from: null, to: null }} onChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /90d/i })).toBeInTheDocument();
  });

  it('clicking 7d preset sets range ending now, 7 days wide', () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker value={{ from: null, to: null }} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: /7d/i }));

    expect(onChange).toHaveBeenCalledOnce();
    const [{ from, to }] = onChange.mock.calls[0];
    expect(from).toBeInstanceOf(Date);
    expect(to).toBeInstanceOf(Date);
    const spanMs = to.getTime() - from.getTime();
    // Allow ±1h slop for DST boundaries inside the window.
    expect(Math.abs(spanMs - 7 * 86_400_000)).toBeLessThan(3_600_000);
    // "to" should be within a second of now()
    expect(Math.abs(to.getTime() - Date.now())).toBeLessThan(1000);
  });

  it('clicking 30d preset sets a 30-day window', () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker value={{ from: null, to: null }} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: /30d/i }));

    const [{ from, to }] = onChange.mock.calls[0];
    const spanMs = to.getTime() - from.getTime();
    expect(Math.abs(spanMs - 30 * 86_400_000)).toBeLessThan(3_600_000);
  });

  it('marks active preset with btn-active when range matches preset width', () => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 86_400_000);
    render(<DateRangePicker value={{ from, to }} onChange={vi.fn()} />);

    const btn7 = screen.getByRole('button', { name: /7d/i });
    expect(btn7.className).toContain('btn-active');
    expect(screen.getByRole('button', { name: /30d/i }).className).not.toContain(
      'btn-active'
    );
  });

  it('applies custom className', () => {
    const { container } = render(
      <DateRangePicker
        value={{ from: null, to: null }}
        onChange={vi.fn()}
        className="custom-class"
      />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('exposes testId on root', () => {
    render(
      <DateRangePicker
        value={{ from: null, to: null }}
        onChange={vi.fn()}
        testId="date-picker"
      />
    );
    expect(screen.getByTestId('date-picker')).toBeInTheDocument();
  });

  describe('keyboard', () => {
    it('Tab walks From → To → 7d → 30d → 90d in DOM order', async () => {
      // The five controls are siblings in a flat flex row, so tab order
      // should match source order. If any of these fail to receive focus,
      // something (tabindex=-1, display:contents on a wrapper) broke the
      // native sequence.
      const user = userEvent.setup();
      render(
        <DateRangePicker value={{ from: null, to: null }} onChange={vi.fn()} />
      );

      await user.tab();
      expect(screen.getByLabelText('From date')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('To date')).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: '7d' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: '30d' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: '90d' })).toHaveFocus();
    });

    it('Enter on a focused preset fires onChange', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <DateRangePicker value={{ from: null, to: null }} onChange={onChange} />
      );

      // Tab to the first preset (past the two date inputs).
      await user.tab();
      await user.tab();
      await user.tab();
      expect(screen.getByRole('button', { name: '7d' })).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledOnce();
      const [{ from, to }] = onChange.mock.calls[0];
      const spanMs = to.getTime() - from.getTime();
      expect(Math.abs(spanMs - 7 * 86_400_000)).toBeLessThan(3_600_000);
    });

    it('Shift+Tab walks backwards', async () => {
      const user = userEvent.setup();
      render(
        <DateRangePicker value={{ from: null, to: null }} onChange={vi.fn()} />
      );

      screen.getByRole('button', { name: '30d' }).focus();
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: '7d' })).toHaveFocus();

      await user.tab({ shift: true });
      expect(screen.getByLabelText('To date')).toHaveFocus();
    });
  });
});
