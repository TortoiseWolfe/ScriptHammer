/**
 * SubscriptionManager Component
 * Manage recurring subscriptions with cancel/pause/resume actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPaymentAmount } from '@/lib/payments/payment-service';

/**
 * Mirrors the `subscriptions` table in the monolithic migration. The table has
 * no `currency` column (amounts are formatted as USD) and tracks cancellation
 * via `status`/`canceled_at` — there is no `cancel_at_period_end` column on our
 * row (the cancel/resume edge functions set status='canceled'/'active').
 */
export interface Subscription {
  id: string;
  provider_subscription_id: string;
  provider: 'stripe' | 'paypal';
  status: 'active' | 'past_due' | 'grace_period' | 'canceled' | 'expired';
  plan_amount: number;
  plan_interval: 'month' | 'year';
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_expires: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionManagerProps {
  userId: string;
  className?: string;
}

/**
 * Manage user subscriptions
 *
 * @example
 * ```tsx
 * function DashboardPage({ userId }: { userId: string }) {
 *   return <SubscriptionManager userId={userId} />;
 * }
 * ```
 */
export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  userId,
  className = '',
}) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch subscriptions
  useEffect(() => {
    const fetchSubscriptions = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('template_user_id', userId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        setSubscriptions((data as unknown as Subscription[]) || []);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to load subscriptions')
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, [userId]);

  // Cancel subscription
  const handleCancel = async (subscriptionId: string) => {
    setActionLoading(subscriptionId);

    try {
      // Call Edge Function to cancel subscription. The function does a
      // server-side ownership check against subscriptions.template_user_id,
      // so we must send the caller's JWT (#105).
      const {
        data: { session: cancelSession },
      } = await supabase.auth.getSession();
      if (!cancelSession?.access_token) {
        throw new Error('No active session — sign in required');
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cancelSession.access_token}`,
          },
          body: JSON.stringify({ subscription_id: subscriptionId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel subscription');
      }

      // Update local state — the edge function marks our row canceled.
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subscriptionId
            ? {
                ...sub,
                status: 'canceled',
                canceled_at: new Date().toISOString(),
              }
            : sub
        )
      );
    } catch (err) {
      alert(
        err instanceof Error ? err.message : 'Failed to cancel subscription'
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Resume subscription
  const handleResume = async (subscriptionId: string) => {
    setActionLoading(subscriptionId);

    try {
      // Call Edge Function to resume subscription (JWT for ownership check, #105).
      const {
        data: { session: resumeSession },
      } = await supabase.auth.getSession();
      if (!resumeSession?.access_token) {
        throw new Error('No active session — sign in required');
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resume-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resumeSession.access_token}`,
          },
          body: JSON.stringify({ subscription_id: subscriptionId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resume subscription');
      }

      // Update local state — the edge function reactivates our row.
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subscriptionId
            ? { ...sub, status: 'active', canceled_at: null }
            : sub
        )
      );
    } catch (err) {
      alert(
        err instanceof Error ? err.message : 'Failed to resume subscription'
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Get status badge
  const getStatusBadge = (subscription: Subscription) => {
    const badges: Record<Subscription['status'], React.ReactElement> = {
      active: <span className="badge badge-success">Active</span>,
      canceled: <span className="badge badge-error">Canceled</span>,
      past_due: <span className="badge badge-warning">Past Due</span>,
      grace_period: <span className="badge badge-warning">Grace Period</span>,
      expired: <span className="badge badge-ghost">Expired</span>,
    };

    return (
      badges[subscription.status] || (
        <span className="badge badge-ghost">Unknown</span>
      )
    );
  };

  // Format interval
  const formatInterval = (interval: Subscription['plan_interval']) => {
    const labels: Record<Subscription['plan_interval'], string> = {
      month: 'Monthly',
      year: 'Yearly',
    };
    return labels[interval] || interval;
  };

  // Days remaining in the grace period (0 when expired/invalid).
  const graceDaysLeft = (expires: string | null): number | null => {
    if (!expires) return null;
    const ms = new Date(expires).getTime();
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.ceil((ms - Date.now()) / 86_400_000));
  };

  if (loading) {
    return (
      <div
        className={`flex flex-col gap-4 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="skeleton h-12 w-full"></div>
        <div className="skeleton h-64 w-full"></div>
        <span className="sr-only">Loading subscriptions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`alert alert-error ${className}`} role="alert">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Error loading subscriptions: {error.message}</span>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className={`card bg-base-100 shadow-xl ${className}`}>
        <div className="card-body items-center text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="text-base-content h-16 w-16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <h3 className="mt-4 text-xl font-bold">No active subscriptions</h3>
          <p className="text-base-content/85">
            You don&apos;t have any subscriptions yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-bold">Subscriptions</h2>
        <div className="badge badge-outline">
          {subscriptions.length} subscription(s)
        </div>
      </div>

      {/* Subscription Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {subscriptions.map((subscription) => (
          <div key={subscription.id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold">
                    {formatPaymentAmount(subscription.plan_amount, 'usd')}
                    <span className="text-base-content/85 ml-2 text-sm font-normal">
                      / {formatInterval(subscription.plan_interval)}
                    </span>
                  </h3>
                  <p className="text-base-content/85 mt-1 capitalize">
                    {subscription.provider}
                  </p>
                </div>
                {getStatusBadge(subscription)}
              </div>

              {/* Details */}
              <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                {subscription.current_period_start &&
                  subscription.current_period_end && (
                    <div className="flex justify-between">
                      <span className="font-semibold">Current Period:</span>
                      <span>
                        {new Date(
                          subscription.current_period_start
                        ).toLocaleDateString()}{' '}
                        -{' '}
                        {new Date(
                          subscription.current_period_end
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                {subscription.current_period_end && (
                  <div className="flex justify-between">
                    <span className="font-semibold">Next Billing:</span>
                    <span>
                      {new Date(
                        subscription.current_period_end
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {(subscription.status === 'grace_period' ||
                  subscription.status === 'past_due') &&
                  (() => {
                    const daysLeft = graceDaysLeft(
                      subscription.grace_period_expires
                    );
                    return (
                      <div
                        className="alert alert-warning p-2 text-xs"
                        role="alert"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 shrink-0 stroke-current"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <span>
                          Payment failed — update your payment method
                          {daysLeft !== null && (
                            <>
                              {' '}
                              to keep your subscription.{' '}
                              <strong>
                                Grace period: {daysLeft} day
                                {daysLeft === 1 ? '' : 's'} remaining.
                              </strong>
                            </>
                          )}
                          {daysLeft === null && '.'}
                        </span>
                      </div>
                    );
                  })()}
              </div>

              {/* Actions — cancel a live subscription, or resume a canceled one. */}
              {subscription.status === 'canceled' && (
                <div className="card-actions mt-4 justify-end">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm min-h-11"
                    onClick={() => handleResume(subscription.id)}
                    disabled={actionLoading === subscription.id}
                    aria-label="Resume subscription"
                  >
                    {actionLoading === subscription.id ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Resuming...
                      </>
                    ) : (
                      'Resume'
                    )}
                  </button>
                </div>
              )}

              {(subscription.status === 'active' ||
                subscription.status === 'past_due' ||
                subscription.status === 'grace_period') && (
                <div className="card-actions mt-4 justify-end">
                  <button
                    type="button"
                    className="btn btn-error btn-sm min-h-11"
                    onClick={() => {
                      if (
                        confirm(
                          'Are you sure you want to cancel this subscription? It will remain active until the end of the current billing period.'
                        )
                      ) {
                        handleCancel(subscription.id);
                      }
                    }}
                    disabled={actionLoading === subscription.id}
                    aria-label="Cancel subscription"
                  >
                    {actionLoading === subscription.id ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Canceling...
                      </>
                    ) : (
                      'Cancel'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

SubscriptionManager.displayName = 'SubscriptionManager';
