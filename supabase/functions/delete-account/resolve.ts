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

/**
 * The slice of the Supabase admin client that deleteAccount touches. Structural, so this file
 * still imports nothing: the Edge Function passes its Deno client and the database test passes
 * a Node service client, and both run the same code path (#1309).
 */
export interface AccountEraser {
  from(table: 'subscriptions'): {
    select(columns: 'status'): {
      eq(
        column: 'template_user_id',
        value: string
      ): PromiseLike<{
        data: Array<{ status: string }> | null;
        error: { message: string } | null;
      }>;
    };
  };
  auth: {
    admin: {
      deleteUser(
        id: string
      ): PromiseLike<{ error: { message: string } | null }>;
      getUserById(
        id: string
      ): PromiseLike<{ data: { user: unknown | null } | null }>;
    };
  };
}

export interface AccountDeletionResult {
  status: 200 | 409 | 500;
  body: { success: true } | { error: string };
}

/**
 * Delete the account `userId`, or say why not. The Edge Function wraps this in HTTP and
 * nothing else, so the database test exercises the decision, the lookup and the delete exactly
 * as production runs them.
 *
 * A subscription that is still billing blocks the deletion (#1309). The delete would set its
 * owner to NULL, after which nothing can cancel it and the provider keeps charging. Fail
 * closed: a lookup that errors is not "no subscriptions".
 */
export async function deleteAccount(
  admin: AccountEraser,
  userId: string
): Promise<AccountDeletionResult> {
  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('status')
    .eq('template_user_id', userId);

  if (subsError) {
    return {
      status: 500,
      body: { error: `Failed to check subscriptions: ${subsError.message}` },
    };
  }

  const blocked = deletionBlockedBy(subs ?? []);
  if (blocked) {
    return { status: 409, body: { error: blocked } };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return {
      status: 500,
      body: { error: `Failed to delete account: ${deleteError.message}` },
    };
  }

  // Confirm rather than assume. #859 was a deletion that returned no error and removed
  // nothing; a success response that has not been checked is the same failure wearing a
  // different status code.
  const { data: stillThere } = await admin.auth.admin.getUserById(userId);
  if (stillThere?.user) {
    return {
      status: 500,
      body: {
        error: 'Account deletion reported success but the user still exists',
      },
    };
  }

  return { status: 200, body: { success: true } };
}
