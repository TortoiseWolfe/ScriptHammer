/**
 * Every decision `create-lead` makes, with nothing imported (#562 T038).
 *
 * WHY THE DECISIONS LIVE HERE RATHER THAN IN `index.ts`. Nothing in CI executes an Edge
 * Function. `tsconfig.json` excludes `supabase/`, Vitest excludes `supabase/functions/**`,
 * and the only gate is `edge-functions.yml`, which runs `deno check` and is deliberately
 * NOT a required check because it resolves imports over the network (#1153). So a decision
 * written inside a `Deno.serve` handler is a decision nothing can test.
 *
 * `create-order/resolve.ts` established the answer: keep the rules in a module that imports
 * nothing, and let `tests/unit/` import it directly. That is why this file has no `import`
 * line and must keep none — one `https://esm.sh/...` here and Vitest can no longer load it.
 */

/**
 * Where a visitor asked to book from.
 *
 * These are the values the database CHECK permits. Keeping the list here as well is not
 * duplication for its own sake: a caller sending an unlisted source would otherwise reach
 * Postgres and fail with a 23514 the browser sees as a 500 — the shape #784 hit on its
 * first live call with `contact_form`.
 */
export const LEAD_SOURCES = ['pricing', 'schedule', 'checkout'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** What actually gets written. Deliberately small. */
export interface LeadRow {
  /** Supplied by the caller so the click can carry it without waiting (#1166). */
  id?: string;
  source: LeadSource;
  product_id: string | null;
}

export type LeadResult =
  | { ok: true; row: LeadRow }
  | { ok: false; problems: string[] };

/** A SKU is a catalog id like `svc-landing`, and it is a FOREIGN KEY, so shape it early. */
const SKU = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * A caller-supplied lead id, which must be a v4 UUID and nothing else.
 *
 * WHY THE CALLER GETS TO CHOOSE IT (#1166). The id has to be on the URL the moment the visitor
 * clicks, because it becomes the booking's hidden `lead_ref` and that is the only thing tying a
 * booking back to a click. Waiting for the server to mint one meant waiting for this function to
 * answer — and a cold Edge Function start beat the 1200ms cap, so the FIRST click after any quiet
 * period silently lost attribution while still recording a perfect-looking lead.
 *
 * What that concedes, said plainly: a collision is a unique violation and harmless, and somebody
 * who picks their own id can mark a lead they invented as `scheduled` — a row they created about
 * themselves. Neither is worth a mechanism. What is NOT conceded is shape: anything that is not a
 * UUID is refused here, so caller text never reaches Postgres.
 */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a submission and produce the row to insert.
 *
 * NOTHING FROM THE REQUEST REACHES THE ROW EXCEPT `source` AND `product_id`, and that is a
 * requirement rather than minimalism. FR-024a forbids storing `utm_*`: the outbound link may
 * carry campaign parameters, and this table may not keep them. Building the row by naming
 * two fields — rather than by spreading the body and deleting what we do not want — is what
 * makes that hold for parameters nobody has thought of yet.
 *
 * `name` and `email` are not accepted either. They are columns on `leads`, but only a
 * confirmed booking can fill them honestly; taking them from an anonymous POST would let
 * any caller write any name against any lead, and putting a form in front of the click is
 * exactly what US-6 exists to avoid.
 */
export function resolveLead(body: unknown): LeadResult {
  const problems: string[] = [];

  if (typeof body !== 'object' || body === null) {
    return { ok: false, problems: ['a JSON object body is required'] };
  }
  const input = body as Record<string, unknown>;

  const source = typeof input.source === 'string' ? input.source.trim() : '';
  if (!source) {
    problems.push('source is required');
  } else if (!(LEAD_SOURCES as readonly string[]).includes(source)) {
    problems.push(
      `source must be one of: ${LEAD_SOURCES.join(', ')} (got "${source}")`
    );
  }

  // Absent and empty both mean "no SKU" — a general "book a call" has none. Only a
  // PRESENT value that does not look like a catalog id is an error worth reporting.
  let productId: string | null = null;
  if (input.product_id !== undefined && input.product_id !== null) {
    const raw = String(input.product_id).trim();
    if (raw !== '') {
      if (!SKU.test(raw)) {
        problems.push('product_id is not a catalog id');
      } else {
        productId = raw;
      }
    }
  }

  let id: string | undefined;
  if (input.id !== undefined && input.id !== null && String(input.id) !== '') {
    const raw = String(input.id).trim();
    if (!UUID_V4.test(raw)) {
      problems.push('id is not a uuid');
    } else {
      id = raw.toLowerCase();
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    row: {
      ...(id ? { id } : {}),
      source: source as LeadSource,
      product_id: productId,
    },
  };
}

/**
 * The caller's IP, as the rate limiter's identifier.
 *
 * `x-forwarded-for` is a LIST when proxies chain, and the ORIGINAL client is the FIRST
 * entry. Taking the last would let a caller prepend their own header and rotate identifiers
 * at will, which is a limiter that cannot limit. Copied deliberately from
 * `contact-message/index.ts:72-79` rather than re-derived.
 */
export function clientIp(headers: {
  get(name: string): string | null;
}): string | null {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('cf-connecting-ip') ?? null;
}

/** The limiter bucket. Must match a literal in `rate_limit_attempts_attempt_type_check`. */
export const ATTEMPT_TYPE = 'booking_lead';
