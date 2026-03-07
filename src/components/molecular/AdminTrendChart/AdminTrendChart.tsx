'use client';

import React from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * DaisyUI semantic colour tokens available for the line/area/points.
 * These map to Tailwind `stroke-*`/`fill-*` utilities, which in turn resolve
 * to DaisyUI CSS custom properties — so the chart re-colours itself whenever
 * `data-theme` changes on `<html>`, no JS required.
 */
export type ChartColorToken =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

/**
 * One line on a multi-series chart. Points must align index-for-index with
 * every other series — the x-axis labels come from series[0] and are assumed
 * to apply to all.
 */
export interface TrendSeries {
  /** Legend label for this line. */
  name: string;
  /** Points, in x-axis order. */
  data: TrendPoint[];
  /** DaisyUI token for this line's stroke + point fill. */
  colorToken: ChartColorToken;
}

export interface AdminTrendChartProps {
  /**
   * Single-series data. Preserved for existing single-line call sites
   * (payments refund-rate). Internally wrapped as a one-element `series`.
   */
  data?: TrendPoint[];
  /** Accessible name for the figure and visible heading. */
  title: string;
  /** Colour token for the single-series form. Default: primary. */
  colorToken?: ChartColorToken;
  /**
   * Multi-series data. When supplied, `data`/`colorToken` are ignored and
   * each series draws its own line + points. Area fill is suppressed —
   * stacked semi-transparent fills turn to sludge — and a legend appears.
   */
  series?: TrendSeries[];
  /** Formatter for y-axis tick labels. Default: String(v). */
  yFormat?: (v: number) => string;
  /** Additional CSS classes on the root. */
  className?: string;
  /** Test ID for testing. */
  testId?: string;
}

// Static class maps. We cannot interpolate `stroke-${token}` because Tailwind
// purges classes it can't find as literal strings at build time.
const STROKE: Record<ChartColorToken, string> = {
  primary: 'stroke-primary',
  secondary: 'stroke-secondary',
  accent: 'stroke-accent',
  info: 'stroke-info',
  success: 'stroke-success',
  warning: 'stroke-warning',
  error: 'stroke-error',
};

const FILL: Record<ChartColorToken, string> = {
  primary: 'fill-primary',
  secondary: 'fill-secondary',
  accent: 'fill-accent',
  info: 'fill-info',
  success: 'fill-success',
  warning: 'fill-warning',
  error: 'fill-error',
};

// Legend swatches use bg-*, not fill-* (they're <span>, not SVG).
const BG: Record<ChartColorToken, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

// Viewbox geometry. The SVG scales responsively via width=100% with viewBox
// governing the aspect ratio (no height attr — "auto" is an <img> thing, the
// SVG spec only takes <length>|<percentage> and Chromium errors on it).
// These are unitless viewBox coordinates, not pixels.
const VB_W = 600;
const VB_H = 240;
const PAD_L = 48; // room for y-axis tick labels
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32; // room for x-axis labels
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;
const Y_TICKS = 4;

/**
 * AdminTrendChart — lightweight inline-SVG line chart.
 *
 * Deliberately avoids a charting library: the only requirements are a line,
 * an area fill, point markers, and a grid. Hand-rolling keeps bundle size flat
 * and — more importantly — lets us colour the SVG with Tailwind utilities so
 * DaisyUI theme switching works for free.
 *
 * @category molecular
 */
export function AdminTrendChart({
  data,
  title,
  colorToken = 'primary',
  series,
  yFormat = String,
  className = '',
  testId,
}: AdminTrendChartProps) {
  // Normalise to a series array so the render path is the same for one line
  // or five. Single-series callers don't know this happened.
  const allSeries: TrendSeries[] = series ?? [
    { name: title, data: data ?? [], colorToken },
  ];
  const multi = allSeries.length > 1;
  const pointCount = allSeries[0]?.data.length ?? 0;

  if (pointCount === 0) {
    return (
      <figure
        aria-label={title}
        className={`flex min-h-48 items-center justify-center rounded-lg border border-base-300 bg-base-100${className ? ` ${className}` : ''}`}
        data-testid={testId}
      >
        <figcaption className="sr-only">{title}</figcaption>
        <p className="text-sm text-base-content/50">No data</p>
      </figure>
    );
  }

  // Shared y-domain across every series — both lines sit on the same scale.
  // When one series dwarfs another (messages in the thousands, conversations
  // in the single digits) the small series hugs the baseline. That's honest:
  // forcing them onto independent axes would make 3 look as tall as 2000.
  const allValues = allSeries.flatMap((s) => s.data.map((d) => d.value));
  const rawMax = Math.max(...allValues);
  const rawMin = Math.min(...allValues);
  // Flat-series guard: if max === min we'd divide by zero in yScale.
  // Pad the domain by 1 in both directions so the line sits mid-plot.
  const domainMax = rawMax === rawMin ? rawMax + 1 : rawMax;
  const domainMin = rawMax === rawMin ? rawMin - 1 : Math.min(0, rawMin);
  const domainSpan = domainMax - domainMin;

  const xScale = (i: number) =>
    pointCount === 1
      ? PAD_L + PLOT_W / 2
      : PAD_L + (i / (pointCount - 1)) * PLOT_W;

  // SVG y grows downward → larger value ⇒ smaller y.
  const yScale = (v: number) =>
    PAD_T + (1 - (v - domainMin) / domainSpan) * PLOT_H;

  // X-axis labels from the first series. All series are assumed to share
  // the same x-positions (same daily_volume array, different fields).
  const xLabels = allSeries[0].data.map((d, i) => ({
    x: xScale(i),
    label: d.label,
  }));

  // Pre-compute points + line path per series. Area only for single-series —
  // overlapping 10%-opacity fills compound into mud, and the eye can't tell
  // which fill belongs to which line anyway.
  const baselineY = yScale(domainMin);
  const plotted = allSeries.map((s) => {
    const pts = s.data.map((d, i) => ({ x: xScale(i), y: yScale(d.value) }));
    const lineD =
      pts.length >= 2
        ? 'M ' + pts.map((p) => `${p.x} ${p.y}`).join(' L ')
        : null;
    const areaD =
      !multi && lineD
        ? `${lineD} L ${pts[pts.length - 1].x} ${baselineY} L ${pts[0].x} ${baselineY} Z`
        : null;
    return {
      series: s,
      points: pts,
      lineD,
      areaD,
      strokeClass: STROKE[s.colorToken],
      fillClass: FILL[s.colorToken],
    };
  });

  // Y ticks include 0 and max of the *raw* data (test asserts max is labelled).
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => {
    const t = i / Y_TICKS;
    // Interpolate across the *raw* range so the top tick equals rawMax.
    // For flat series rawMax===rawMin and every tick label is that value,
    // which is fine — the gridlines still spread evenly over the padded domain.
    return rawMin + t * (rawMax - rawMin);
  });

  return (
    <figure
      aria-label={title}
      className={`rounded-lg border border-base-300 bg-base-100 p-4${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <figcaption className="text-sm font-medium text-base-content">
          {title}
        </figcaption>
        {multi && (
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/70"
            data-chart-legend
          >
            {allSeries.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`inline-block h-2 w-2 rounded-full ${BG[s.colorToken]}`}
                />
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        role="img"
        aria-label={`${title} chart`}
        className="overflow-visible"
      >
        {/* Gridlines + y-axis tick labels */}
        {yTicks.map((tick, i) => {
          // Spread gridlines evenly over the plot regardless of flat-series
          // domain padding — the lines are a visual guide, not data.
          const gy = PAD_T + (1 - i / Y_TICKS) * PLOT_H;
          return (
            <g key={i}>
              <line
                data-chart-grid
                x1={PAD_L}
                y1={gy}
                x2={PAD_L + PLOT_W}
                y2={gy}
                className="stroke-base-300"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 8}
                y={gy}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-base-content/60 text-[10px]"
              >
                {yFormat(tick)}
              </text>
            </g>
          );
        })}

        {plotted.map((p) => (
          <g key={p.series.name} data-chart-series={p.series.name}>
            {p.areaD && (
              <path
                data-chart-area
                d={p.areaD}
                className={`${p.fillClass} opacity-10`}
                stroke="none"
              />
            )}
            {p.lineD && (
              <path
                data-chart-line
                d={p.lineD}
                className={p.strokeClass}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {p.points.map((pt, i) => (
              <circle
                key={i}
                data-chart-point
                cx={pt.x}
                cy={pt.y}
                r={3}
                className={p.fillClass}
              />
            ))}
          </g>
        ))}

        {/* X-axis labels — rendered once, not per series */}
        {xLabels.map((xl, i) => (
          <text
            key={i}
            x={xl.x}
            y={VB_H - 8}
            textAnchor="middle"
            className="fill-base-content/60 text-[10px]"
          >
            {xl.label}
          </text>
        ))}
      </svg>
    </figure>
  );
}

export default AdminTrendChart;
