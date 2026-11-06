/**
 * Decision logic for delete-account that needs no Deno, so vitest can exercise it (#1309).
 * Imports nothing, on purpose: that is what makes it testable.
 */

/**
 * Subscription statuses that are still billing at the provider. Same set as the
 * `idx_subscriptions_one_live_per_user` partial index in the monolithic migration, which is
 * the schema's own definition of "live". `canceling` counts: a cancel-at-period-end
 * subscription is charged until the period closes.
 */
export const LIVE_SUBSCRIPTION_STATUSES = [
  'active',
  'grace_period',
  'past_due',
  'canceling',
] as const;

export const LIVE_SUBSCRIPTION_MESSAGE =
  'You have a subscription that is still billing. Cancel it first, then delete your account.';

/**
 * Whether the account may be deleted now.
 *
 * Deleting an account sets the subscription's owner to NULL (ON DELETE SET NULL, #1309). The
 * row stays, but nothing can cancel it any more: the cancel function authorises by owner. The
 * provider would go on charging a person who no longer has an account to stop it from. Before
 * #1309 the foreign key blocked that by accident; now the refusal has to be deliberate.
 */
export function deletionBlockedBy(
  subscriptions: ReadonlyArray<{ status: string }>
): string | null {
  const live = subscriptions.some((s) =>
    (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(s.status)
  );
  return live ? LIVE_SUBSCRIPTION_MESSAGE : null;
}
