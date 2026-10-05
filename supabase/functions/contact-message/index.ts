/**
 * Deliver a contact-form submission by email, using infrastructure this project
 * already owns (#784).
 *
 * WHY THIS EXISTS. `/contact/` posted to Web3Forms, a third-party service keyed by
 * `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`. Production shipped that key EMPTY, so every
 * submission threw `Web3Forms access key is not configured` and the page delivered
 * nothing — while Stripe's `support_url` pointed paying customers straight at it.
 *
 * Resend is already wired for this domain (verified sender, DKIM/SPF intact, and
 * `RESEND_API_KEY` is already an Edge Function secret), so routing contact mail
 * through it removes an entire third-party dependency and one more credential
 * nobody was watching.
 *
 * THE RECIPIENT IS FIXED SERVER-SIDE AND IS NEVER TAKEN FROM THE REQUEST.
 * This is the security property that matters, not a detail. A contact endpoint
 * that lets the caller choose `to` is an open relay: #353 records this project's
 * sign-up form being abused to send mail to non-consenting third parties. Here the
 * caller controls only the BODY and the `reply_to`; the destination comes from
 * environment configuration. The worst an abuser achieves is spam into our own
 * inbox.
 *
 * RATE LIMITED PER IP (#784): 5 submissions per 15 minutes, over `rate_limit_attempts`.
 *
 * ONE CALL, BEFORE THE SEND (#1245 stage A3, #1237). This used to check the limit and then
 * record the attempt — two round trips, so every request in a concurrent burst passed the
 * check before any record landed, and the ceiling held only against callers polite enough to
 * wait their turn. `consume_rate_limit` counts and decides in one statement. Its answer goes
 * through `limiterVerdict`, which treats anything but an explicit allowance as "cannot
 * check" — the old test (`allowed === false`) let a null answer straight through.
 * `tests/unit/edge-function-limiter.test.ts` pins the call, its count and its order.
 *
 * The IP comes from `clientIp` below; why its choice of header entry is safe is recorded
 * there (#1237, measured).
 *
 * BOT CHECKS BEFORE THE LIMITER (#1319). A per-IP limit throttles one address; it cannot see a
 * script spread across many. So, in order: a foreign `Origin` is refused before the body is
 * read; a reply-to on a reserved domain is refused with the field errors; and when
 * `TURNSTILE_SECRET` is set, a Turnstile token is required and checked with Cloudflare. All
 * three run before the limiter, so a refused bot never spends a real visitor's budget on a
 * shared IP. Each decision lives in `rules.ts`, which Vitest can load.
 *
 * ONE MESSAGE, ONE EMAIL (#1322). The send carries an `Idempotency-Key` derived from the
 * message's content (`rules.ts` says why content and not a token). A visitor whose response was
 * lost can press Send again — with a fresh Turnstile token — and Resend returns the original
 * response instead of delivering a second copy. Resend keeps keys for 24 hours.
 *
 * TURNSTILE IS INERT UNTIL ITS SECRET EXISTS. A fork with no `TURNSTILE_SECRET` behaves exactly
 * as before, and the rollout order is safe: ship the page that sends tokens, then this
 * function, then the secret. Setting the secret first would refuse every visitor whose page
 * predates the widget.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { allowedOrigins, handleCors, jsonResponse } from '../_shared/cors.ts';
import { limiterVerdict } from '../_shared/limiter-verdict.ts';
import {
  captchaTokenFrom,
  idempotencyKeyFor,
  isUndeliverableAddress,
  originVerdict,
  resendOutcome,
  SITEVERIFY_URL,
  siteverifyVerdict,
  type CaptchaVerdict,
} from './rules.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/**
 * Where submissions are delivered, and the address they are sent FROM.
 *
 * Both are REQUIRED with no default. A fallback to this maintainer's domain would
 * put upstream's inbox behind every fork's contact form, and would try to send from
 * a domain the fork does not own in Resend — the #392 failure (one person's identity
 * shipped to everyone) with a delivery failure on top. Missing config fails loudly.
 */
const CONTACT_TO = Deno.env.get('CONTACT_TO');
const CONTACT_FROM = Deno.env.get('CONTACT_FROM');

/**
 * The server half of `NEXT_PUBLIC_CAPTCHA_SITE_KEY` — the same Turnstile widget sign-up uses
 * (#353). Optional: unset means no token is asked for (see the header).
 */
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET');

/** The message a refused challenge shows; the form puts it in front of the visitor verbatim. */
const CHALLENGE_MESSAGE =
  'Please complete the verification challenge and try again.';

/**
 * What a visitor reads when delivery cannot be confirmed (#1322). Pressing Send again is safe
 * because the idempotency key makes a resend of the same text a no-op. The client carries the
 * same sentence for the case where no response arrived at all
 * (`src/utils/email/types.ts`, UNCONFIRMED_MESSAGE).
 */
const UNCONFIRMED_MESSAGE =
  "We couldn't confirm your message was sent. Press Send again: if it already arrived, it won't be sent twice.";

const LIMITS = { name: 100, email: 254, subject: 200, message: 5000 };

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Keep submitted text out of the header block of the outbound message. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

const ATTEMPT_TYPE = 'contact_form';

/**
 * The caller's IP, as the limiter's identifier.
 *
 * WHY THE FIRST `x-forwarded-for` ENTRY, AND WHY THAT IS SAFE HERE (#1237). Supabase's edge
 * puts the true client address first: measured on production 2026-09-24, a request sent with
 * `X-Forwarded-For: 203.0.113.9` was keyed on the sender's real public IPv4 — not on the
 * spoofed value, and not on any internal or shared address. So entry [0] is trustworthy
 * because the platform SETS it, not because of which end of the list a client can reach (a
 * client can always write the leftmost entry of a header it sends; an edge that merely
 * appended would make [0] the attacker's). If this ever moves behind a different proxy,
 * re-measure before trusting [0]: send a TEST-NET value and read which key the limiter used.
 */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? null;
}

/** Ask Cloudflare whether a Turnstile token is genuine. Never throws. */
async function verifyCaptcha(
  token: string,
  ip: string | null
): Promise<CaptchaVerdict> {
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json().catch(() => null);
    const verdict = siteverifyVerdict(res.ok, json);
    if (verdict !== 'pass') {
      console.warn('turnstile verdict', verdict, json?.['error-codes']);
    }
    return verdict;
  } catch (error) {
    console.error('turnstile siteverify unreachable', error);
    return 'unavailable';
  }
}

/** Service-role client — the limiter functions are SECURITY DEFINER. */
function adminClient() {
  const url =
    Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  if (!RESEND_API_KEY || !CONTACT_TO || !CONTACT_FROM) {
    // Name what is missing in the log, never in the response — the response is
    // public. Returning 500 rather than a cheerful 200 is deliberate: a contact
    // form that reports success while delivering nothing is the exact defect
    // this function replaces.
    console.error('contact-message misconfigured', {
      hasKey: Boolean(RESEND_API_KEY),
      hasTo: Boolean(CONTACT_TO),
      hasFrom: Boolean(CONTACT_FROM),
    });
    return jsonResponse(
      req,
      { error: 'Contact delivery is not configured' },
      500
    );
  }

  // Before the body is read: a page on another site has no business here (rules.ts says why).
  const origin = originVerdict(req.headers.get('origin'), allowedOrigins());
  if (!origin.ok) {
    console.warn('contact-message refused a foreign origin', origin.origin);
    return jsonResponse(
      req,
      { error: 'This form only accepts messages from its own site.' },
      403
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
  }

  // Honeypot: a real browser leaves this empty. Answer 200 so a bot cannot tell
  // it was detected, but send nothing.
  if (typeof body._gotcha === 'string' && body._gotcha.trim() !== '') {
    return jsonResponse(req, { success: true }, 200);
  }

  const name = singleLine(String(body.name ?? ''));
  const email = singleLine(String(body.email ?? '')).toLowerCase();
  const subject = singleLine(String(body.subject ?? ''));
  const message = String(body.message ?? '').trim();

  const problems: string[] = [];
  if (!name) problems.push('name is required');
  if (name.length > LIMITS.name) problems.push('name is too long');
  if (!email || !isEmail(email)) problems.push('a valid email is required');
  if (email.length > LIMITS.email) problems.push('email is too long');
  if (email && isEmail(email) && isUndeliverableAddress(email)) {
    problems.push('please use an email address we can reply to');
  }
  if (!subject) problems.push('subject is required');
  if (subject.length > LIMITS.subject) problems.push('subject is too long');
  if (!message) problems.push('message is required');
  if (message.length > LIMITS.message) problems.push('message is too long');

  if (problems.length > 0) {
    // A sentence, because the form shows a refusal verbatim (#1319).
    const text = problems.join('; ');
    return jsonResponse(
      req,
      { error: `${text.charAt(0).toUpperCase()}${text.slice(1)}.` },
      400
    );
  }

  const ip = clientIp(req);

  // ── bot check (#1319) ───────────────────────────────────────────────────────
  // Before the limiter, so a request that fails it never counts against an IP a
  // real visitor may share. Inert without the secret (see the header).
  if (TURNSTILE_SECRET) {
    const token = captchaTokenFrom(body);
    const verdict = token ? await verifyCaptcha(token, ip) : 'rejected';
    if (verdict === 'unavailable') {
      return jsonResponse(req, { error: 'Could not send the message' }, 503);
    }
    if (verdict !== 'pass') {
      return jsonResponse(req, { error: CHALLENGE_MESSAGE }, 403);
    }
  }

  // ── rate limit (#784) ──────────────────────────────────────────────────────
  // AFTER validation so malformed junk cannot burn a legitimate sender's budget,
  // and BEFORE the send so a limited caller costs us no Resend quota.
  const admin = adminClient();

  if (!ip || !admin) {
    // FAIL CLOSED on the pieces that make limiting possible. An open contact
    // endpoint with no ceiling is the thing this guard exists to prevent, and
    // "we could not check" is not a reason to skip the check — that is how a
    // limiter becomes decorative. Logged so the cause is visible.
    console.error('contact-message cannot rate limit', {
      hasIp: Boolean(ip),
      hasAdmin: Boolean(admin),
    });
    return jsonResponse(req, { error: 'Could not send the message' }, 503);
  }

  // Counted BEFORE sending, in the same statement that decides. If the send then
  // fails, the attempt is still spent — deliberate: the alternative lets a caller
  // hammer a failing provider without limit, which is exactly when the ceiling
  // matters most.
  const limit = await admin.rpc('consume_rate_limit', {
    p_identifier: ip,
    p_attempt_type: ATTEMPT_TYPE,
    p_ip_address: ip,
  });
  const verdict = limiterVerdict(limit);

  if (verdict === 'unavailable') {
    // Do NOT proceed. A send that was not counted makes the limit advisory, and an
    // advisory limit on an anonymous endpoint is none.
    console.error('rate limit unavailable', limit.error);
    return jsonResponse(req, { error: 'Could not send the message' }, 503);
  }

  if (verdict === 'refused') {
    return jsonResponse(
      req,
      {
        error:
          'Too many messages from this address. Please wait a few minutes and try again.',
      },
      429
    );
  }

  const idempotencyKey = await idempotencyKeyFor({
    name,
    email,
    subject,
    message,
  });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
      // Same content, same key: a resend returns the original response (#1322).
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: CONTACT_FROM,
      to: [CONTACT_TO], // server-side constant — never `body.to`
      reply_to: email, // replying reaches the visitor without them choosing the destination
      subject: `[contact] ${subject}`,
      text:
        `From: ${name} <${email}>\n` +
        `Subject: ${subject}\n\n` +
        `${message}\n\n` +
        // Only an allowlisted origin is printed (rules.ts). This used to echo the
        // header verbatim, so a caller could name any page they liked as the source.
        `— sent from the contact form via ${origin.label}`,
    }),
  });

  const data = await res.json().catch(() => ({}));
  const outcome = resendOutcome(res.ok, res.status, data);

  if (outcome === 'already-sent') {
    // This text was delivered earlier: a resend after a lost response. Nothing new went out,
    // and the visitor's message did arrive, so this is a success.
    console.info('contact-message: duplicate of an already-delivered message');
    return jsonResponse(req, { success: true, id: null, duplicate: true }, 200);
  }

  if (outcome === 'in-flight') {
    // The first send of this text is still in progress, so its outcome is unknown. Say exactly
    // that, with a 409 the client reads as "could not confirm" and never as a refusal.
    return jsonResponse(req, { error: UNCONFIRMED_MESSAGE }, 409);
  }

  if (outcome === 'rejected') {
    console.error('Resend rejected the contact message', data);
    return jsonResponse(req, { error: 'Could not send the message' }, 502);
  }

  return jsonResponse(req, { success: true, id: data.id ?? null }, 200);
});
