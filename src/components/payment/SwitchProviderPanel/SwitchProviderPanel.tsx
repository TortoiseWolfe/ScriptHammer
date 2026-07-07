/**
 * SwitchProviderPanel
 *
 * Inline panel that lets the user switch payment provider after a decline.
 * Reads the parent intent (the failed one) via `getParentIntentForRetry`,
 * mounts a `<PaymentButton>` pre-filled with the parent's amount + currency
 * + type + email + description, and links the new intent to the parent via
 * `parent_intent_id` so the audit chain is preserved across providers.
 *
 * Reuses everything PaymentButton already does — Stripe / PayPal / Cash App
 * / Chime selection, GDPR consent gating, offline queueing — without
 * rebuilding any of it.
 *
 * Reframes US3 (Update Payment Method, FR-011-FR-015) for ScriptHammer's
 * static-export architecture: there are no saved cards to "update", but
 * there is a meaningful user-facing action — picking a different provider
 * after a decline.
 */

'use client';

import React from 'react';
import { PaymentButton } from '@/components/payment/PaymentButton/PaymentButton';
import {
  getParentIntentForRetry,
  formatPaymentAmount,
  PaymentRetryLimitError,
  PaymentRetryExpiredError,
  type ParentIntentForRetry,
} from '@/lib/payments/payment-service';

export interface SwitchProviderPanelProps {
  /** UUID of the failed parent payment intent. */
  parentIntentId: string;
  /** Called when the user successfully creates a new intent via the switch. */
  onSwitchSuccess?: (newIntentId: string) => void;
  /** Called when the new payment fails (forwarded from PaymentButton). */
  onSwitchError?: (error: Error) => void;
  className?: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; parent: ParentIntentForRetry }
  | { kind: 'limit-reached' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

export const SwitchProviderPanel: React.FC<SwitchProviderPanelProps> = ({
  parentIntentId,
  onSwitchSuccess,
  onSwitchError,
  className = '',
}) => {
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    (async () => {
      try {
        const parent = await getParentIntentForRetry(parentIntentId);
        if (!cancelled) {
          setState({ kind: 'ready', parent });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PaymentRetryLimitError) {
          setState({ kind: 'limit-reached' });
        } else if (err instanceof PaymentRetryExpiredError) {
          setState({ kind: 'expired' });
        } else {
          setState({
            kind: 'error',
            message:
              err instanceof Error
                ? err.message
                : 'Could not load original payment',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parentIntentId]);

  if (state.kind === 'loading') {
    return (
      <div
        className={`flex items-center gap-3 ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="loading loading-spinner loading-sm"></span>
        <span className="text-sm">Loading payment options&hellip;</span>
      </div>
    );
  }

  if (state.kind === 'limit-reached') {
    return (
      <div
        className={`alert alert-warning ${className}`}
        role="alert"
        aria-live="assertive"
      >
        This payment has reached the maximum retry attempts. Please contact
        support.
      </div>
    );
  }

  if (state.kind === 'expired') {
    return (
      <div
        className={`alert alert-warning ${className}`}
        role="alert"
        aria-live="assertive"
      >
        This payment session has expired. Please start a new payment.
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div
        className={`alert alert-error ${className}`}
        role="alert"
        aria-live="assertive"
      >
        {state.message}
      </div>
    );
  }

  const { parent } = state;
  const formattedAmount = formatPaymentAmount(parent.amount, parent.currency);

  return (
    <div className={`card bg-base-200 ${className}`}>
      <div className="card-body">
        <h3 className="card-title text-base">Use a different payment method</h3>
        <p className="text-sm opacity-70">
          Switching from your previous attempt:{' '}
          <span className="font-semibold">{formattedAmount}</span>
          {parent.description ? (
            <>
              {' '}
              for <span className="italic">{parent.description}</span>
            </>
          ) : null}
          .
        </p>
        <PaymentButton
          amount={parent.amount}
          currency={parent.currency}
          type={parent.type}
          customerEmail={parent.customer_email}
          description={parent.description ?? undefined}
          parentIntentId={parentIntentId}
          onSuccess={onSwitchSuccess}
          onError={onSwitchError}
        />
      </div>
    </div>
  );
};

SwitchProviderPanel.displayName = 'SwitchProviderPanel';
