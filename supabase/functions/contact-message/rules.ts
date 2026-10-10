/**
 * Every decision `contact-message` makes about a request, with nothing imported (#1319).
 *
 * WHY THE DECISIONS LIVE HERE. Nothing in CI executes an Edge Function: `tsconfig.json`
 * excludes `supabase/`, Vitest excludes `supabase/functions/**`, and `edge-functions.yml` only
 * runs `deno check`. A rule written inside `Deno.serve` is a rule nothing tests. Same split as
 * `create-lead/resolve.ts` — and the same constraint: no `import` line, ever, or Vitest can no
 * longer load this file. `tests/unit/contact-message-rules.test.ts` imports it directly.
 */

/**
 * Domains that can never receive mail: RFC 2606 reserves the three `example.*` second-level
 * names, and RFC 2606 / RFC 6761 the four top-level ones.
 *
 * A message whose reply-to sits on one of these can never be answered, so delivering it only
 * fills the inbox. They are also what every test fixture in this repo uses — #1319 found all
 * thirteen contact emails ever delivered were Playwright fixtures on `example.com` — so this
 * makes a spec that forgets to stub the network undeliverable by construction.
 */
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];
const RESERVED_TLDS = ['example', 'test', 'invalid', 'localhost'];

export function isUndeliverableAddress(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return true;
  // A trailing dot is the same DNS name (`example.com.`), so it must not slip past.
  const labels = email
    .slice(at + 1)
    .toLowerCase()
    .replace(/\.+$/, '')
    .split('.');
  if (RESERVED_TLDS.includes(labels[labels.length - 1])) return true;
  // Subdomains are reserved with their parent: `mail.example.com` is no more deliverable.
  return RESERVED_DOMAINS.includes(labels.slice(-2).join('.'));
}

export type OriginVerdict =
  | { ok: true; label: string }
  | { ok: false; origin: string };

/**
 * What to make of the request's `Origin` header.
 *
 * ABSENT: not a browser making a cross-origin call — a script or a server. Nothing to check
 * here; the captcha and the per-IP limit carry it. The footer says so rather than inventing a
 * page.
 *
 * ALLOWLISTED: the page that sent it, and the only case where the value is printed. The footer
 * used to print whatever the caller sent, so `Origin: https://anything/they-like` arrived in
 * the inbox labelled as the place the message came from.
 *
 * ANYTHING ELSE: refused. A browser always sends `Origin` on a cross-origin POST, and a
 * `no-cors` request with a text body needs no preflight, so CORS alone does not stop another
 * site's page from making its visitors submit here — each with their own IP, which is exactly
 * what a per-IP limit cannot see. `"null"` (sandboxed frames, `file:`) is foreign too.
 */
export function originVerdict(
  origin: string | null,
  allowed: readonly string[]
): OriginVerdict {
  if (origin === null || origin === '') {
    return { ok: true, label: 'a direct request (no browser origin)' };
  }
  if (allowed.includes(origin)) return { ok: true, label: origin };
  return { ok: false, origin };
}

/** Cloudflare's server-side check for a Turnstile token. */
export const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare documents tokens of up to 2048 characters; anything longer is not one. */
const MAX_TOKEN_LENGTH = 2048;

/** The token the browser sent, or null when there is nothing worth asking Cloudflare about. */
export function captchaTokenFrom(body: Record<string, unknown>): string | null {
  const token = body.captchaToken;
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (trimmed === '' || trimmed.length > MAX_TOKEN_LENGTH) return null;
  return trimmed;
}

/**
 * Resend's `Idempotency-Key` for a message, derived from its content (#1322).
 *
 * WHY CONTENT, NOT A KEY THE BROWSER SENDS. `fetch` cannot tell "never arrived" from "arrived,
 * sent, and the response was lost", so a visitor may resend a message that was delivered. A
 * client-chosen key fails the case that matters most: with Turnstile on, a resend needs a fresh
 * single-use token and a fresh submit, and nothing ties that submit to the first one but its
 * text. Hashing the text makes every resend of the same message within Resend's 24-hour window
 * return the original response without sending — automatic retries and a visitor pressing Send
 * again alike — with nothing stored here.
 *
 * WHY NOT THE TOKEN. Keying on `sha256(captchaToken)` and replaying a spent token was considered
 * and rejected: Turnstile reports a spent and an expired token the same way, so an old token would
 * stay good for one send per 24 hours indefinitely, which is the expiry Turnstile exists to give.
 *
 * Global Web Crypto only, so this file still imports nothing.
 */
export async function idempotencyKeyFor(fields: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<string> {
  const canonical = JSON.stringify([
    fields.name,
    fields.email,
    fields.subject,
    fields.message,
  ]);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical)
  );
  const hex = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  return `contact-message/${hex}`;
}

export type ResendOutcome = 'sent' | 'already-sent' | 'in-flight' | 'rejected';

/**
 * Read Resend's answer to a send that carried an `Idempotency-Key` (#1322).
 *
 * Both 409s are about THIS content having been sent before, and neither delivers a second copy:
 * `invalid_idempotent_request` means the same key arrived with a different payload — the same
 * text, sent earlier through a different origin's footer — so the message was already delivered.
 * `concurrent_idempotent_requests` means the first send is still in progress, so the outcome is
 * not known yet. Anything else that is not OK is a rejection, as before.
 */
export function resendOutcome(
  ok: boolean,
  status: number,
  json: unknown
): ResendOutcome {
  if (ok) return 'sent';
  const name = (json as { name?: unknown } | null)?.name;
  if (status === 409 && name === 'invalid_idempotent_request') {
    return 'already-sent';
  }
  if (status === 409 && name === 'concurrent_idempotent_requests') {
    return 'in-flight';
  }
  return 'rejected';
}

export type CaptchaVerdict = 'pass' | 'rejected' | 'unavailable';

/**
 * Read siteverify's answer. Only an explicit `success: true` is a pass.
 *
 * `internal-error` is Cloudflare saying IT failed, not that the visitor did, so it is reported
 * as unavailable rather than blamed on them. Both refuse the send — a check that could not run
 * is not a check that passed, the same stance `limiterVerdict` takes.
 */
export function siteverifyVerdict(ok: boolean, json: unknown): CaptchaVerdict {
  if (!ok) return 'unavailable';
  const answer = json as { success?: unknown; 'error-codes'?: unknown } | null;
  if (answer?.success === true) return 'pass';
  if (answer?.success !== false) return 'unavailable';
  const codes = Array.isArray(answer['error-codes'])
    ? answer['error-codes']
    : [];
  return codes.includes('internal-error') ? 'unavailable' : 'rejected';
}
