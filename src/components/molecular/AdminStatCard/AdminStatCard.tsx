'use client';

import React from 'react';

export interface AdminStatCardProps {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string | number;
  /** Optional description text */
  description?: string;
  /** Trend direction */
  trend?: 'up' | 'down' | 'neutral';
  /** Optional link href */
  href?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * AdminStatCard component - Displays a single statistic with optional trend indicator
 *
 * @category molecular
 */
export function AdminStatCard({
  label,
  value,
  description,
  trend,
  href,
  className = '',
  testId,
}: AdminStatCardProps) {
  const trendIcon =
    trend === 'up' ? ' \u2191' : trend === 'down' ? ' \u2193' : '';
  const trendColor =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-error'
        : 'text-base-content';

  const content = (
    <div className="stat">
      <div className="stat-title">{label}</div>
      <div className={`stat-value ${trendColor}`}>
        {value}
        {trendIcon}
      </div>
      {description && <div className="stat-desc">{description}</div>}
    </div>
  );

  const ariaLabel = `${label}: ${value}`;

  if (href) {
    return (
      <a
        href={href}
        className={`stats bg-base-100 shadow hover:shadow-md${className ? ` ${className}` : ''}`}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={`stats bg-base-100 shadow${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {content}
    </div>
  );
}

export default AdminStatCard;
