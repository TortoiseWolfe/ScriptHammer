import React from 'react';

export type SparklineTone = 'primary' | 'success' | 'error' | 'info';

export interface SparklineProps {
  /** Dense ordered series, oldest → newest. Index-mapped to x. */
  data: number[];
  /** Theme-token stroke. Literal var() string so DaisyUI recolors at paint
      time on theme switch — no JS reads computed color. */
  tone?: SparklineTone;
  /** Accessible label. If omitted the SVG is aria-hidden (decorative). */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for root element */
  testId?: string;
}

const VB_W = 100;
const VB_H = 24;
// 1px vertical gutter so a flat-at-max line doesn't clip against the viewBox
// edge with its 1.5-unit stroke width.
const PAD_Y = 1;
const PLOT_H = VB_H - PAD_Y * 2;

const TOKEN: Record<SparklineTone, string> = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-info)',
};

/**
 * Single-series SVG sparkline. No axes, no labels, no dates — just the
 * shape. Designed to sit inside a stat card as a "last 7 days" glance cue.
 *
 * Like PaymentTrendChart: zero dependencies, theme-reactive via literal
 * var() tokens. Unlike PaymentTrendChart: one line, one fill, no text.
 *
 * @category molecular
 */
export default function Sparkline({
  data,
  tone = 'primary',
  label,
  className = '',
  testId,
}: SparklineProps) {
  // Fewer than 2 points can't draw a line. An all-zero series CAN —
  // it draws a flat line at y=bottom, which is itself informative
  // ("nothing happened this week").
  if (data.length < 2) {
    return (
      <div
        className={className || undefined}
        data-testid={testId}
        data-empty=""
        aria-hidden="true"
      />
    );
  }

  // Clamp to 1 so an all-zero series yields y=bottom, not 0/0.
  const maxY = Math.max(1, ...data);
  const xStep = VB_W / (data.length - 1);
  const yOf = (v: number) => PAD_Y + PLOT_H - (v / maxY) * PLOT_H;

  const points = data
    .map((v, i) => `${(i * xStep).toFixed(1)},${yOf(v).toFixed(1)}`)
    .join(' ');

  // Area fill: polyline points + close the shape along the bottom edge.
  const areaPath = `M 0,${VB_H} L ${points.replace(/ /g, ' L ')} L ${VB_W},${VB_H} Z`;

  const stroke = TOKEN[tone];
  const ariaProps = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      preserveAspectRatio="none"
      className={className || undefined}
      data-testid={testId}
      {...ariaProps}
    >
      <path d={areaPath} fill={stroke} fillOpacity={0.15} />
      <polyline
        data-series=""
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
