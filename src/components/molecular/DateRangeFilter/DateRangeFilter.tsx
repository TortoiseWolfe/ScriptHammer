'use client';

import React from 'react';

export interface DateRange {
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
}

export interface DateRangeFilterProps {
  /** Controlled value — omit for uncontrolled preset-only use */
  value?: DateRange;
  /** Fires on every input change and preset click */
  onChange: (range: DateRange) => void;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for root element */
  testId?: string;
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): DateRange {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - n);
  return { start: toISODate(start), end: toISODate(end) };
}

/**
 * DateRangeFilter component — two native date inputs plus preset buttons.
 * Native inputs give us the platform date picker free, keyboard-accessible,
 * and zero JS bundle cost. min/max constrain the range so start ≤ end.
 *
 * @category molecular
 */
export default function DateRangeFilter({
  value,
  onChange,
  className = '',
  testId,
}: DateRangeFilterProps) {
  const start = value?.start ?? '';
  const end = value?.end ?? '';

  return (
    // A recessed WELL grouping the two date fields and the presets into one
    // panel (#430). Shared by four of the six admin routes, so this single edit
    // is the highest-leverage change in the console.
    //
    // `p-4` is load-bearing: sh-well is an inset shadow painted BELOW child
    // content, so opaque children flush to the edge would hide it and the
    // change would be a visual no-op.
    <div
      className={`sh-well bg-base-100 rounded-box flex flex-wrap items-end gap-4 p-4${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      <div>
        <label className="label" htmlFor="date-range-start">
          <span>Start date</span>
        </label>
        <input
          id="date-range-start"
          type="date"
          className="input min-h-11"
          value={start}
          max={end || undefined}
          onChange={(e) => onChange({ start: e.target.value, end })}
        />
      </div>

      <div>
        <label className="label" htmlFor="date-range-end">
          <span>End date</span>
        </label>
        <input
          id="date-range-end"
          type="date"
          className="input min-h-11"
          value={end}
          min={start || undefined}
          onChange={(e) => onChange({ start, end: e.target.value })}
        />
      </div>

      <div className="join" role="group" aria-label="Date range presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="btn join-item min-h-11 min-w-11"
            onClick={() => onChange(daysAgo(p.days))}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
