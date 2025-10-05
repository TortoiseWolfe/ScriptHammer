/**
 * SubscriptionManager Component
 * Manage recurring subscriptions with cancel/pause/resume actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPaymentAmount } from '@/lib/payments/payment-service';
import type { Currency, PaymentInterval } from '@/types/payment';

export interface Subscription {
  id: string;
  provider_subscription_id: string;
  provider: 'stripe' | 'paypal';
  status: 'active' | 'canceled' | 'past_due' | 'paused';
  amount: number;
  currency: Currency;
  interval: PaymentInterval;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
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
      // Call Edge Function to cancel subscription
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscription_id: subscriptionId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel subscription');
      }

      // Update local state
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subscriptionId
            ? { ...sub, cancel_at_period_end: true }
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
      // Call Edge Function to resume subscription
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resume-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscription_id: subscriptionId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resume subscription');
      }

      // Update local state
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subscriptionId
            ? { ...sub, cancel_at_period_end: false }
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
    if (subscription.cancel_at_period_end) {
      return <span className="badge badge-warning">Canceling</span>;
    }

    const badges = {
      active: <span className="badge badge-success">Active</span>,
      canceled: <span className="badge badge-error">Canceled</span>,
      past_due: <span className="badge badge-warning">Past Due</span>,
      paused: <span className="badge badge-info">Paused</span>,
    };

    return (
      badges[subscription.status] || (
        <span className="badge badge-ghost">Unknown</span>
      )
    );
  };

  // Format interval
  const formatInterval = (interval: PaymentInterval) => {
    const labels = {
      month: 'Monthly',
      year: 'Yearly',
      week: 'Weekly',
      day: 'Daily',
    };
    return labels[interval] || interval;
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
            className="text-base-content/30 h-16 w-16"
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
          <p className="text-base-content/70">
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
                    {formatPaymentAmount(
                      subscription.amount,
                      subscription.currency
                    )}
                    <span className="text-base-content/70 ml-2 text-sm font-normal">
                      / {formatInterval(subscription.interval)}
                    </span>
                  </h3>
                  <p className="text-base-content/70 mt-1 capitalize">
                    {subscription.provider}
                  </p>
                </div>
                {getStatusBadge(subscription)}
              </div>

              {/* Details */}
              <div className="mt-4 space-y-2 border-t pt-4 text-sm">
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

                <div className="flex justify-between">
                  <span className="font-semibold">Next Billing:</span>
                  <span>
                    {new Date(
                      subscription.current_period_end
                    ).toLocaleDateString()}
                  </span>
                </div>

                {subscription.cancel_at_period_end && (
                  <div className="alert alert-warning p-2 text-xs">
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
                    <span>Will cancel at period end</span>
                  </div>
                )}

                {subscription.status === 'past_due' && (
                  <div className="alert alert-error p-2 text-xs">
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
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Payment failed. Please update payment method.</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {subscription.status === 'active' && (
                <div className="card-actions mt-4 justify-end">
                  {subscription.cancel_at_period_end ? (
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
                  ) : (
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
                  )}
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
