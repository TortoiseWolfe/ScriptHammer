'use client';

import React from 'react';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePickerProps {
  /** Current range (controlled) */
  value: DateRange;
  /** Fires with the full new range on any edit */
  onChange: (range: DateRange) => void;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

// <input type="date"> wants yyyy-mm-dd in the *local* timezone. Using
// toISOString would shift by the UTC offset and show the wrong day for
// anyone west of Greenwich after ~16:00.
function toDateInputValue(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateInputValue(s: string): Date | null {
  if (!s) return null;
  // yyyy-mm-dd → local midnight. Avoid new Date(s) which parses as UTC
  // for date-only strings and causes the same off-by-one.
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * DateRangePicker component — two date inputs plus quick-preset buttons.
 *
 * @category molecular
 */
export function DateRangePicker({
  value,
  onChange,
  className = '',
  testId,
}: DateRangePickerProps) {
  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    onChange({ from, to });
  };

  // Active-preset highlight: match on window width (±1h for DST).
  const spanDays =
    value.from && value.to
      ? (value.to.getTime() - value.from.getTime()) / 86_400_000
      : null;
  const isActive = (days: number) =>
    spanDays !== null && Math.abs(spanDays - days) < 1 / 24;

  return (
    <div
      className={`flex flex-wrap items-end gap-3${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      <label className="form-control">
        <span className="label-text mb-1 text-xs">From</span>
        <input
          type="date"
          aria-label="From date"
          className="input input-bordered input-sm min-h-11"
          value={toDateInputValue(value.from)}
          onChange={(e) =>
            onChange({ ...value, from: fromDateInputValue(e.target.value) })
          }
        />
      </label>

      <label className="form-control">
        <span className="label-text mb-1 text-xs">To</span>
        <input
          type="date"
          aria-label="To date"
          className="input input-bordered input-sm min-h-11"
          value={toDateInputValue(value.to)}
          onChange={(e) =>
            onChange({ ...value, to: fromDateInputValue(e.target.value) })
          }
        />
      </label>

      <div className="join" role="group" aria-label="Date range presets">
        {PRESETS.map(({ label, days }) => (
          <button
            key={label}
            type="button"
            className={`btn join-item btn-sm min-h-11 ${isActive(days) ? 'btn-active' : 'btn-ghost'}`}
            onClick={() => applyPreset(days)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DateRangePicker;
