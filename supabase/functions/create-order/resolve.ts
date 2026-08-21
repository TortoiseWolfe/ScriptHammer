/**
 * create-order — pure decision logic (#557, #558).
 *
 * ZERO IMPORTS, DELIBERATELY. Everything here is a pure function over plain data,
 * which is what lets Vitest exercise it without Deno. `vitest.config.ts` excludes
 * `supabase/functions/**` from test DISCOVERY, not from module resolution, so a
 * test under `tests/` imports this file directly; `tsconfig` excludes `supabase`
 * as a compilation ROOT, but tsc follows imports, so being imported by an included
 * test type-checks it. Both properties hold only while this file imports nothing.
 *
 * Every other Edge Function in this repo calls `serve(async (req) => {` at module
 * top level with the whole handler inline, which is precisely why their Deno tests
 * assert nothing beyond "the module parses" — see
 * create-stripe-checkout/index.test.ts:17-21, which says so in a comment and asks
 * for this refactor. This is the first function to do it.
 *
 * THE PREMISE: the buyer's device stops being able to name a price.
 */

// ---------------------------------------------------------------------------
// Shapes (structural — no dependency on generated Supabase types)
// ---------------------------------------------------------------------------

export interface ProductRow {
  id: string;
  amount: number;
  amount_mode: 'fixed' | 'variable';
  min_amount: number | null;
  max_amount: number | null;
  currency: string;
  type: 'one_time' | 'recurring';
  interval: string | null;
  active: boolean;
  metadata: Record<string, unknown> | null;
  name: string;
}

/** What the idempotency store told us. `unavailable` is NOT the same as `miss`. */
export type IdempotencyLookup =
  | { state: 'miss' }
  | {
      state: 'hit';
      result: Record<string, unknown>;
      fingerprint: string | null;
    }
  | { state: 'unavailable'; reason: string };

export interface ResolveInput {
  /** null when no active product matched the requested id. */
  product: ProductRow | null;
  /** Whatever the caller sent. Deliberately typed `unknown`. */
  submittedAmount?: unknown;
  idempotencyKey: string | null;
  lookup: IdempotencyLookup;
  /** Stable hash of the meaningful request fields. */
  requestFingerprint: string;
}

export type Decision =
  | { kind: 'replay'; result: Record<string, unknown> }
  | {
      kind: 'proceed';
      amountCents: number;
      isDeposit: boolean;
      fullPriceCents: number;
    }
  | { kind: 'refuse'; status: number; error: string };

// Mirrors payment_intents.amount CHECK. Duplicated as a guard, never as the
// authority — the database constraint is the only real control.
export const MIN_CHARGE_CENTS = 100;

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

/**
 * Resolve what to charge.
 *
 * FOR FIXED SKUs THE SUBMITTED AMOUNT IS DISCARDED, NOT VALIDATED. FR-002 words
 * it that way on purpose: rejecting a mismatch with "expected 120000" tells the
 * caller their guess was wrong, which turns a silent server-authoritative design
 * into a price oracle. Ignoring it leaks nothing and is strictly safer.
 *
 * For `variable` SKUs (the tip jar) the submitted amount IS the input, so it is
 * the one place a client number is honoured — and therefore the one place it must
 * be validated hard. `validatePaymentAmount` in src/config/payment.ts checks
 * neither integer-ness nor NaN; nothing fed it user input before, and a
 * pay-what-you-want field is exactly what makes that matter.
 */
export function resolveChargeAmount(
  product: ProductRow,
  submittedAmount: unknown
):
  | {
      ok: true;
      amountCents: number;
      isDeposit: boolean;
      fullPriceCents: number;
    }
  | { ok: false; status: number; error: string } {
  if (product.amount_mode === 'variable') {
    if (
      typeof submittedAmount !== 'number' ||
      !Number.isFinite(submittedAmount)
    ) {
      return {
        ok: false,
        status: 400,
        error: 'amount is required for this item',
      };
    }
    if (!Number.isInteger(submittedAmount)) {
      return {
        ok: false,
        status: 400,
        error: 'amount must be a whole number of cents',
      };
    }
    const min = product.min_amount ?? MIN_CHARGE_CENTS;
    const max = product.max_amount ?? Number.MAX_SAFE_INTEGER;
    if (submittedAmount < min || submittedAmount > max) {
      // Bounds are public — the tip-jar screen states "$1 to $500" to the
      // visitor — so echoing them leaks nothing.
      return {
        ok: false,
        status: 400,
        error: `amount must be between ${min} and ${max} cents`,
      };
    }
    return {
      ok: true,
      amountCents: submittedAmount,
      isDeposit: false,
      fullPriceCents: submittedAmount,
    };
  }

  // Fixed. `submittedAmount` is not read past this point, by design.
  const full = product.amount;

  if (full < MIN_CHARGE_CENTS) {
    // prd-forge is $0 and display-only; payment_intents floors at 100 cents, so
    // a $0 SKU could never produce an intent anyway. Refuse with a reason rather
    // than letting it fail later as an opaque constraint violation.
    return {
      ok: false,
      status: 400,
      error: `${product.id} is not purchasable`,
    };
  }

  const pct = depositPercent(product);
  if (pct === null) {
    return {
      ok: true,
      amountCents: full,
      isDeposit: false,
      fullPriceCents: full,
    };
  }

  // Round DOWN. A rounding error must never charge more than the stated price.
  const deposit = Math.floor((full * pct) / 100);
  if (deposit < MIN_CHARGE_CENTS) {
    return {
      ok: true,
      amountCents: full,
      isDeposit: false,
      fullPriceCents: full,
    };
  }
  return {
    ok: true,
    amountCents: deposit,
    isDeposit: true,
    fullPriceCents: full,
  };
}

/** `metadata.deposit_pct`, or null when the SKU is billed in full. */
export function depositPercent(product: ProductRow): number | null {
  const raw = product.metadata?.['deposit_pct'];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (!Number.isInteger(raw) || raw <= 0 || raw >= 100) return null;
  return raw;
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * FAIL CLOSED. If we cannot tell whether this request was already processed, we
 * do not process it.
 *
 * This deliberately reverses _shared/idempotency.ts's fail-open default, and the
 * reasoning is worth keeping next to the code rather than only in a PR:
 *
 *   fail-open   dedupe store down -> the sale proceeds. Worst case is a DUPLICATE
 *               CHARGE, which costs a refund, a support conversation and trust.
 *               The guard stops guarding at exactly the moment something is
 *               already wrong, and it does so silently.
 *   fail-closed dedupe store down -> the sale is blocked and the buyer retries.
 *               Worst case is a moment's friction, and the failure is loud.
 *
 * Fail-open IS defensible where the provider dedupes downstream: Stripe honours
 * its own Idempotency-Key, so a duplicated create-stripe-checkout is harmless.
 * That is not this function. create-order writes our own `orders` and
 * `payment_intents` rows BEFORE any provider is involved, and nothing downstream
 * would collapse the duplicates.
 *
 * A key with a DIFFERENT payload is a 409, not a replay — the same rule Stripe
 * applies. Replaying would hand back a silently wrong-product order to a client
 * that had asked for something else, and nothing would surface it.
 */
export function decideIdempotency(
  key: string | null,
  lookup: IdempotencyLookup,
  requestFingerprint: string
):
  | { kind: 'proceed' }
  | { kind: 'replay'; result: Record<string, unknown> }
  | { kind: 'refuse'; status: number; error: string } {
  // No key supplied: the caller opted out of protection. Nothing to verify, so
  // there is nothing to fail closed ON.
  if (!key) return { kind: 'proceed' };

  if (lookup.state === 'unavailable') {
    return {
      kind: 'refuse',
      status: 503,
      error:
        'Could not verify whether this request was already processed. ' +
        'Nothing was charged — please retry.',
    };
  }

  if (lookup.state === 'hit') {
    // A stored row with no fingerprint predates fingerprinting. Replaying is the
    // safe reading: the key was used, and we cannot prove it was for something
    // else.
    if (
      lookup.fingerprint !== null &&
      lookup.fingerprint !== requestFingerprint
    ) {
      return {
        kind: 'refuse',
        status: 409,
        error:
          'This Idempotency-Key was already used for a different request. ' +
          'Use a new key for a new order.',
      };
    }
    return { kind: 'replay', result: lookup.result };
  }

  return { kind: 'proceed' };
}

// ---------------------------------------------------------------------------
// The whole decision
// ---------------------------------------------------------------------------

export function resolveOrder(input: ResolveInput): Decision {
  // Idempotency FIRST. A replay must not depend on the product still existing or
  // still being priced the same — the buyer already completed that transaction.
  const idem = decideIdempotency(
    input.idempotencyKey,
    input.lookup,
    input.requestFingerprint
  );
  if (idem.kind === 'refuse') return idem;
  if (idem.kind === 'replay') return { kind: 'replay', result: idem.result };

  if (!input.product) {
    // Same 404 for "no such SKU" and "inactive SKU". Distinguishing them would
    // let anyone enumerate unreleased products.
    return { kind: 'refuse', status: 404, error: 'product not found' };
  }
  if (!input.product.active) {
    return { kind: 'refuse', status: 404, error: 'product not found' };
  }

  const priced = resolveChargeAmount(input.product, input.submittedAmount);
  if (!priced.ok) {
    return { kind: 'refuse', status: priced.status, error: priced.error };
  }

  return {
    kind: 'proceed',
    amountCents: priced.amountCents,
    isDeposit: priced.isDeposit,
    fullPriceCents: priced.fullPriceCents,
  };
}

// ---------------------------------------------------------------------------
// Request fingerprint
// ---------------------------------------------------------------------------

/**
 * Stable hash of the fields that make a request "the same request".
 *
 * Intake is deliberately EXCLUDED: correcting a typo in a phone number and
 * retrying with the same key is the same purchase, and 409-ing that would be
 * hostile. Product, amount and email are what change what gets charged.
 *
 * djb2 rather than a crypto hash so this file stays import-free. It is a
 * collision check between two of the caller's own requests, not a security
 * boundary — a forged collision only lets a caller replay their own order.
 */
export function fingerprintRequest(parts: {
  productId: string;
  amount?: unknown;
  buyerEmail?: string;
}): string {
  const canonical = JSON.stringify([
    parts.productId,
    typeof parts.amount === 'number' ? parts.amount : null,
    (parts.buyerEmail ?? '').trim().toLowerCase(),
  ]);
  let h = 5381;
  for (let i = 0; i < canonical.length; i++) {
    h = ((h << 5) + h + canonical.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Build the `orders` row.
 *
 * THIS EXISTS BECAUSE OF A REAL DEFECT, and the defect was invisible to every
 * test that existed at the time. The first version inlined this in index.ts and
 * hardcoded `buyer_user_id: null`, reasoning that a guest "has no account yet".
 *
 * `orders`' only buyer-facing policy is `SELECT USING (auth.uid() =
 * buyer_user_id)`. A null there is therefore not a neutral placeholder — it
 * makes the row unreadable by the one person entitled to read it. The order was
 * written correctly, priced correctly, and could never be seen again by the
 * buyer, so /checkout's return leg would sit on "still being confirmed" forever.
 *
 * An anonymous session is a real `auth.users` row with a real uid. RLS has no
 * concept of a second-class user, so neither does this.
 *
 * It is a separate pure function so the invariant is unit-testable: index.ts
 * cannot be imported from vitest (Deno URL imports), which is exactly why the
 * original bug shipped past a green suite.
 */
/** FR-014. Mirrors MAX_FILES in src/lib/commerce/intake-upload.ts. */
export const MAX_ATTACHMENTS = 8;

const ATTACHMENT_KINDS = ['current', 'target', 'unspecified'] as const;

/**
 * Re-derive which attachments this buyer is actually entitled to claim (T021).
 *
 * The client sends `intake.attachments` as an array it composed itself. Storage RLS
 * already stops a buyer WRITING outside `{their uid}/…`, but nothing stops them
 * POSTing an order whose attachment list points at somebody else's path — and
 * /admin/orders renders those paths through signed URLs, which are minted with
 * service-role and therefore honour no RLS at all. Trusting the echoed list would
 * turn "guess a path" into "have the operator open it for you".
 *
 * So ownership is recomputed here from the authenticated uid rather than believed:
 * anything not under `${buyerUserId}/` is dropped, the list is capped, and only the
 * four known fields survive. Silently dropping rather than rejecting is deliberate —
 * a buyer whose upload half-failed should still be able to complete a purchase, and
 * the operator sees the files that genuinely exist.
 *
 * Pure and exported for the same reason as buildOrderRow: index.ts cannot be
 * imported from vitest, and an unverifiable security check is not a security check.
 */
export function sanitizeAttachments(
  raw: unknown,
  buyerUserId: string
): Array<Record<string, unknown>> {
  if (!Array.isArray(raw) || !buyerUserId) return [];
  const prefix = `${buyerUserId}/`;
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (out.length >= MAX_ATTACHMENTS) break;
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    const path = typeof a.path === 'string' ? a.path : '';

    // The whole check. `startsWith` alone is not enough: a path may not then climb
    // back out with `..`, and it must stay a single segment under the uid so it
    // cannot address another user's folder.
    if (!path.startsWith(prefix)) continue;
    if (path.includes('..')) continue;
    if (path.slice(prefix.length).includes('/')) continue;
    if (seen.has(path)) continue;
    seen.add(path);

    const kind = ATTACHMENT_KINDS.includes(
      a.kind as (typeof ATTACHMENT_KINDS)[number]
    )
      ? (a.kind as string)
      : 'unspecified';

    out.push({
      path,
      name: typeof a.name === 'string' ? a.name.slice(0, 255) : 'attachment',
      bytes: typeof a.bytes === 'number' && a.bytes >= 0 ? a.bytes : 0,
      mime: typeof a.mime === 'string' ? a.mime.slice(0, 128) : '',
      kind,
    });
  }
  return out;
}

/**
 * The `payment_intents` row a create-order purchase writes.
 *
 * PURE AND EXPORTED for the same reason as buildOrderRow: `index.ts` cannot be imported
 * from vitest (`supabase/functions/**` is excluded, and no workflow runs `deno test`), so
 * anything decided inline in the handler is decided where CI cannot see it.
 *
 * WHY IT CARRIES THE IDEMPOTENCY KEY (#559). create-order reads `Idempotency-Key` and
 * claims it in `edge_idempotency_keys`, which dedupes at the REQUEST layer. It did not put
 * the key on the row, so every intent created through checkout had
 * `idempotency_key = NULL`, and two things followed:
 *
 *   1. `idx_payment_intents_idempotency_key` — a partial unique index that exists precisely
 *      to stop duplicate intents — never applied to a single catalog purchase.
 *   2. Retry lineage broke. `payment-service.ts` reads `parent.idempotency_key` and mints a
 *      fresh UUID when it is null, so a retry of a create-order intent could not dedupe
 *      against the attempt it was retrying.
 *
 * Both layers now key off the same value: the header dedupes the REQUEST, the column
 * dedupes the ROW and anchors the retry chain.
 *
 * A null key is legitimate and preserved as null — the partial index ignores nulls, and a
 * caller that sends no header simply gets the previous behaviour.
 */
export function buildIntentRow(input: {
  userId: string;
  amountCents: number;
  product: {
    currency: string;
    type: string;
    interval: string | null;
    name: string;
    id: string;
  };
  buyerEmail: string;
  isDeposit: boolean;
  idempotencyKey: string | null;
}): Record<string, unknown> {
  if (!input.userId) {
    // Same reasoning as buildOrderRow: refusing beats writing a row nobody can read.
    throw new Error('buildIntentRow: userId is required');
  }

  return {
    template_user_id: input.userId,
    amount: input.amountCents,
    currency: input.product.currency,
    type: input.product.type,
    interval: input.product.interval,
    customer_email: input.buyerEmail,
    description: input.isDeposit
      ? `${input.product.name} (50% deposit)`
      : input.product.name,
    // Intake does NOT go here. metadata is capped at 1KB serialised
    // (metadata-validator.ts) and a job description blows straight past it;
    // it lives on orders.intake_data, which is unbounded JSONB.
    metadata: { product_id: input.product.id, is_deposit: input.isDeposit },
    idempotency_key: input.idempotencyKey,
  };
}

export function buildOrderRow(input: {
  intentId: string;
  productId: string;
  buyerUserId: string;
  buyerEmail: string;
  amountCents: number;
  intake?: Record<string, unknown>;
}): Record<string, unknown> {
  if (!input.buyerUserId) {
    // Refusing beats writing a row nobody can read. The caller already has the
    // uid — getAuthenticatedUserId throws before this point if it does not.
    throw new Error('buildOrderRow: buyerUserId is required');
  }

  const intake = { ...(input.intake ?? {}) };
  // Always overwrite, never merge: if the client sent no attachments key at all we
  // must still not leave a stale or absent one, and if it sent a hostile one it must
  // not survive. `sanitizeAttachments` returning [] for junk is the desired outcome.
  if ('attachments' in intake || Array.isArray(intake.attachments)) {
    intake.attachments = sanitizeAttachments(
      intake.attachments,
      input.buyerUserId
    );
  }

  return {
    intent_id: input.intentId,
    product_id: input.productId,
    buyer_user_id: input.buyerUserId,
    buyer_email: input.buyerEmail,
    amount_charged: input.amountCents,
    status: 'pending',
    // Unbounded JSONB. Deliberately NOT payment metadata, which is capped at 1KB
    // serialised and which a job description blows straight past.
    intake_data: intake,
  };
}
