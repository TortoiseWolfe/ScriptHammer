import React from 'react';
import type { DailyPaymentPoint } from '@/services/admin/admin-payment-service';

export interface PaymentTrendChartProps {
  /** Dense ordered daily series from admin_payment_trends (gap days already zero-filled) */
  data: DailyPaymentPoint[];
  /** Additional CSS classes */
  className?: string;
  /** Test ID for root element */
  testId?: string;
}

// Logical viewBox — scales with container width via width="100%".
const VB_W = 1000;
const VB_H = 280;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;
const PLOT_BOTTOM = PAD_T + PLOT_H;

// Theme tokens referenced literally. DaisyUI v5 defines these as full oklch()
// values per [data-theme], so the browser resolves them at paint time and
// recolors the chart on theme switch with no JS involvement whatsoever.
// Tests assert these strings verbatim — that's the theme-reactive contract.
const TOKEN = {
  succeeded: 'var(--color-success)',
  failed: 'var(--color-error)',
  grid: 'var(--color-base-300)',
} as const;

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Two-line SVG trend chart: succeeded (success token) + failed (error token).
 * Zero dependencies, zero JS color reading. The RPC returns a dense ordered
 * series so x is index-mapped — no date math needed here.
 *
 * @category molecular
 */
export default function PaymentTrendChart({
  data,
  className = '',
  testId,
}: PaymentTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={`text-base-content flex h-48 items-center justify-center${className ? ` ${className}` : ''}`}
        data-testid={testId}
      >
        No activity in this range
      </div>
    );
  }

  // Clamp to 1 so an all-zero range yields y=bottom rather than 0/0.
  const maxY = Math.max(1, ...data.map((d) => Math.max(d.succeeded, d.failed)));

  // N=1 would divide by zero when spreading across the x-axis — center instead.
  const xStep = data.length > 1 ? PLOT_W / (data.length - 1) : 0;
  const xOf = (i: number) =>
    data.length > 1 ? PAD_L + i * xStep : PAD_L + PLOT_W / 2;
  const yOf = (v: number) => PLOT_BOTTOM - (v / maxY) * PLOT_H;

  const toPoints = (pick: (d: DailyPaymentPoint) => number) =>
    data
      .map((d, i) => `${xOf(i).toFixed(1)},${yOf(pick(d)).toFixed(1)}`)
      .join(' ');

  const totalSucceeded = data.reduce((s, d) => s + d.succeeded, 0);
  const totalFailed = data.reduce((s, d) => s + d.failed, 0);
  const ariaLabel = `Payment activity trend: ${totalSucceeded} succeeded, ${totalFailed} failed over ${data.length} days`;

  const gridYs = [PLOT_BOTTOM, PAD_T + PLOT_H / 2, PAD_T];

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className={className || undefined}
      data-testid={testId}
    >
      {gridYs.map((y) => (
        <line
          key={y}
          data-grid=""
          x1={PAD_L}
          y1={y}
          x2={PAD_L + PLOT_W}
          y2={y}
          stroke={TOKEN.grid}
          strokeWidth={1}
        />
      ))}

      <polyline
        data-series="succeeded"
        points={toPoints((d) => d.succeeded)}
        fill="none"
        stroke={TOKEN.succeeded}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        data-series="failed"
        points={toPoints((d) => d.failed)}
        fill="none"
        stroke={TOKEN.failed}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* y-axis: 0 and max — currentColor picks up text-base-content from ancestor */}
      <text
        x={PAD_L - 8}
        y={PLOT_BOTTOM}
        textAnchor="end"
        dominantBaseline="middle"
        fontSize={12}
        fill="currentColor"
        opacity={0.6}
      >
        0
      </text>
      <text
        x={PAD_L - 8}
        y={PAD_T}
        textAnchor="end"
        dominantBaseline="middle"
        fontSize={12}
        fill="currentColor"
        opacity={0.6}
      >
        {maxY}
      </text>

      {/* x-axis: bounds only — 90-day ranges would be noise otherwise */}
      <text
        x={xOf(0)}
        y={PLOT_BOTTOM + 20}
        textAnchor="start"
        fontSize={12}
        fill="currentColor"
        opacity={0.6}
      >
        {shortDay(data[0].day)}
      </text>
      {data.length > 1 && (
        <text
          x={xOf(data.length - 1)}
          y={PLOT_BOTTOM + 20}
          textAnchor="end"
          fontSize={12}
          fill="currentColor"
          opacity={0.6}
        >
          {shortDay(data[data.length - 1].day)}
        </text>
      )}
    </svg>
  );
}
