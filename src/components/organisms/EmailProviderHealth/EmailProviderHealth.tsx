'use client';

import React from 'react';
import type { ProviderStatus } from '@/utils/email/types';

/** Rate-limit snapshot from emailService.getRateLimitStatus(). */
export interface EmailRateLimitStatus {
  remaining: number;
  resetTime: number;
  isLimited: boolean;
}

export interface EmailProviderHealthProps {
  /** Per-provider health from emailService.getStatus() */
  providers: ProviderStatus[];
  /** Rate-limit snapshot from emailService.getRateLimitStatus() */
  rateLimitStatus: EmailRateLimitStatus | null;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

function formatResetTime(resetTime: number): string {
  return new Date(resetTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * EmailProviderHealth — admin-facing health dashboard for the dual-provider
 * email abstraction (#34). Renders one card per provider (priority, availability,
 * failure count, healthy flag, last error) plus the current send rate-limit.
 * Pure presentational; the page wires it to emailService.getStatus() /
 * getRateLimitStatus().
 *
 * @category organisms
 */
export default function EmailProviderHealth({
  providers,
  rateLimitStatus,
  isLoading = false,
  className = '',
  testId = 'email-provider-health',
}: EmailProviderHealthProps) {
  if (isLoading) {
    return (
      <div
        className={`flex flex-col gap-4 ${className}`}
        role="status"
        aria-live="polite"
        data-testid={testId}
      >
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-40 w-full" />
        <span className="sr-only">Loading email provider health…</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${className}`} data-testid={testId}>
      {/* Rate limit */}
      <section aria-labelledby="email-rate-limit-heading">
        <h2 id="email-rate-limit-heading" className="mb-3 text-xl font-bold">
          Send Rate Limit
        </h2>
        {rateLimitStatus ? (
          <div className="stats stats-vertical sm:stats-horizontal shadow">
            <div className="stat">
              <div className="stat-title">Remaining</div>
              <div className="stat-value text-2xl">
                {rateLimitStatus.remaining}
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">Status</div>
              <div className="stat-value text-2xl">
                {rateLimitStatus.isLimited ? (
                  <span className="badge badge-error badge-lg">
                    Rate limited
                  </span>
                ) : (
                  <span className="badge badge-success badge-lg">OK</span>
                )}
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">Window resets</div>
              <div className="stat-value text-2xl">
                {formatResetTime(rateLimitStatus.resetTime)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-base-content/70">Rate-limit status unavailable.</p>
        )}
      </section>

      {/* Providers */}
      <section aria-labelledby="email-providers-heading">
        <h2 id="email-providers-heading" className="mb-3 text-xl font-bold">
          Providers
        </h2>
        {providers.length === 0 ? (
          <div className="alert alert-warning" role="alert">
            <span>No email providers configured.</span>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {providers.map((p) => (
              <div
                key={p.name}
                className="card bg-base-100 shadow-xl"
                data-testid={`email-provider-${p.name}`}
              >
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{p.name}</h3>
                      <p className="text-base-content/70 text-sm">
                        Priority {p.priority}
                      </p>
                    </div>
                    {p.healthy ? (
                      <span className="badge badge-success">Healthy</span>
                    ) : (
                      <span className="badge badge-error">Unhealthy</span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-semibold">Available</span>
                      <span>{p.available ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Recent failures</span>
                      <span>{p.failures}</span>
                    </div>
                    {p.lastError && (
                      <div
                        className="alert alert-error mt-2 p-2 text-xs"
                        role="alert"
                      >
                        <span>Last error: {p.lastError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
