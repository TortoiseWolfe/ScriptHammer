import React from 'react';
import type { DailyMessagingPoint } from '@/services/admin/admin-messaging-service';

export interface MessagingTrendChartProps {
  /** Dense ordered daily series from admin_messaging_trends (gap days already zero-filled) */
  data: DailyMessagingPoint[];
  /** Additional CSS classes */
  className?: string;
  /** Test ID for root element */
  testId?: string;
}

// Same viewBox geometry as PaymentTrendChart — the two charts sit in
// equivalent slots on sibling admin pages, so matched dimensions keep
// the scroll rhythm identical.
const VB_W = 1000;
const VB_H = 280;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;
const PLOT_BOTTOM = PAD_T + PLOT_H;

// messages → info is the established hue — AdminDashboardOverview's
// spark-messages uses tone="info". Keeping the detail chart on the same
// token means "messages" reads the same color whether you're at the
// overview or drilled into /admin/messaging. conversations_created gets
// primary, distinct from info under every DaisyUI theme.
const TOKEN = {
  messages: 'var(--color-info)',
  conversations: 'var(--color-primary)',
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
 * Two-line SVG trend: messages (info token) + conversations_created (primary).
 * Single shared y-axis — messages will dwarf conversations most days, and
 * the chart says so honestly rather than faking parity with a second axis.
 *
 * @category molecular
 */
export default function MessagingTrendChart({
  data,
  className = '',
  testId,
}: MessagingTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={`text-base-content/60 flex h-48 items-center justify-center${className ? ` ${className}` : ''}`}
        data-testid={testId}
      >
        No activity in this range
      </div>
    );
  }

  // Clamp to 1 so an all-zero range yields y=bottom rather than 0/0.
  const maxY = Math.max(
    1,
    ...data.map((d) => Math.max(d.messages, d.conversations_created))
  );

  const xStep = data.length > 1 ? PLOT_W / (data.length - 1) : 0;
  const xOf = (i: number) =>
    data.length > 1 ? PAD_L + i * xStep : PAD_L + PLOT_W / 2;
  const yOf = (v: number) => PLOT_BOTTOM - (v / maxY) * PLOT_H;

  const toPoints = (pick: (d: DailyMessagingPoint) => number) =>
    data
      .map((d, i) => `${xOf(i).toFixed(1)},${yOf(pick(d)).toFixed(1)}`)
      .join(' ');

  const totalMessages = data.reduce((s, d) => s + d.messages, 0);
  const totalConvs = data.reduce((s, d) => s + d.conversations_created, 0);
  const ariaLabel = `Messaging volume trend: ${totalMessages} messages, ${totalConvs} conversations created over ${data.length} days`;

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
        data-series="messages"
        points={toPoints((d) => d.messages)}
        fill="none"
        stroke={TOKEN.messages}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        data-series="conversations"
        points={toPoints((d) => d.conversations_created)}
        fill="none"
        stroke={TOKEN.conversations}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* y-axis: 0 and max — currentColor inherits text-base-content */}
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

      {/* x-axis: bounds only */}
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
