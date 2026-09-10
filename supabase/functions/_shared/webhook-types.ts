/**
 * The two shapes every payment webhook needs typed — and neither was (#1153).
 *
 * Nothing in this repo had ever run `deno check` over `supabase/functions/**`: vitest excludes
 * the directory, no workflow runs `deno check`, and `tsconfig.json` excludes it (correctly — it
 * is Deno, the app is Node). So `pnpm type-check` passing said nothing about the most
 * security-sensitive code here. The first run found 21 errors, all four functions on the money
 * path. Thirteen of them were these two families.
 */

/**
 * What a webhook event handler returns.
 *
 * WHY A DECLARED TYPE AND NOT INFERENCE. Each `case` in the event switch returned a different
 * object literal, so TypeScript inferred a UNION of five shapes — and reading
 * `processResult.related_payment_id` off that union is an error, because the property is absent
 * from some members. The code was correct at runtime (the spread is guarded by a truthiness
 * check) and unprovable at compile time.
 *
 * Every field is optional because every handler legitimately omits most of them.
 */
export interface WebhookHandlerResult {
  handled: boolean;
  related_payment_id?: string;
  related_subscription_id?: string;
  subscription_id?: string;
  /**
   * Why a handler declined to act, when it did. Real values in use today:
   * `incomplete_not_persisted`, `incomplete_expired`, `duplicate_live_subscription`.
   * It is logged, never persisted — but omitting it from this type made three correct
   * returns into errors, which is the type learning about the code rather than the reverse.
   */
  reason?: string;
}

/**
 * The message from an unknown thrown value.
 *
 * WHY THIS IS NOT COSMETIC. Five `catch` blocks read `err.message` off an `unknown`, and under
 * `useUnknownInCatchVariables` that is an error — but the runtime consequence is the point: a
 * thrown non-Error (a string, a rejected fetch value, `undefined`) makes `err.message`
 * `undefined`, so the handler returns a 500 whose body says nothing. On the path a payment
 * provider RETRIES against, an opaque 500 is the difference between a diagnosable failure and a
 * silent retry loop.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
}

/**
 * A Supabase client, typed by the shape callers actually use.
 *
 * WHY NOT `ReturnType<typeof createClient>`. Without generated database types the client's
 * schema generic is `any`, and supabase-js then infers `.insert()` payloads as `never[]` and
 * `.select()` rows as `never` — so `create-order` failed with "Property 'id' does not exist on
 * type 'never'" on code that is correct at runtime. The declared type was actively worse than
 * no type: it made every query provably wrong.
 *
 * WHAT THIS HONESTLY CLAIMS, stated so nobody reads more into it. It types the CLIENT — a
 * function that takes one cannot be handed something else — and deliberately does NOT claim the
 * query chains are checked. They never were: checking them needs generated types
 * (`supabase gen types`), which this project does not produce. Pretending otherwise would be a
 * green gate over nothing, which is the failure this whole issue is about.
 */
export interface SupabaseLike {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}
