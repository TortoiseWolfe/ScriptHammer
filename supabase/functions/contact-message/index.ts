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
 * RATE LIMITED PER IP (#784), by reusing the limiter the auth forms already use —
 * `check_rate_limit` / `record_failed_attempt` over `rate_limit_attempts`, which is
 * SECURITY DEFINER, takes a row lock, and manages the sliding window. 5 submissions
 * per 15 minutes per IP.
 *
 * Reused rather than reinvented: a second hand-rolled limiter would be a second
 * thing to get wrong, and this one is already exercised by the auth specs. Note
 * `record_failed_attempt` is named for its original use — it is simply the
 * limiter's INCREMENT primitive, and a contact submission is not a failure. The
 * name is wrong for this caller and the behaviour is right; renaming it would mean
 * a production migration for cosmetics.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';

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
 * `x-forwarded-for` is a LIST when proxies chain; the ORIGINAL client is the first
 * entry. Taking the last would let a caller prepend their own header and rotate
 * identifiers at will, which is a limiter that cannot limit.
 */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? null;
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
  if (!subject) problems.push('subject is required');
  if (subject.length > LIMITS.subject) problems.push('subject is too long');
  if (!message) problems.push('message is required');
  if (message.length > LIMITS.message) problems.push('message is too long');

  if (problems.length > 0) {
    return jsonResponse(req, { error: problems.join('; ') }, 400);
  }

  // ── rate limit (#784) ──────────────────────────────────────────────────────
  // AFTER validation so malformed junk cannot burn a legitimate sender's budget,
  // and BEFORE the send so a limited caller costs us no Resend quota.
  const ip = clientIp(req);
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

  const { data: limit, error: limitError } = await admin.rpc(
    'check_rate_limit',
    { p_identifier: ip, p_attempt_type: ATTEMPT_TYPE, p_ip_address: ip }
  );

  if (limitError) {
    console.error('rate limit check failed', limitError);
    return jsonResponse(req, { error: 'Could not send the message' }, 503);
  }

  if (limit && limit.allowed === false) {
    return jsonResponse(
      req,
      {
        error:
          'Too many messages from this address. Please wait a few minutes and try again.',
      },
      429
    );
  }

  // Count this submission BEFORE sending. If the send then fails, the attempt is
  // still spent — deliberate: the alternative lets a caller hammer a failing
  // provider without limit, which is exactly when the ceiling matters most.
  const { error: recordError } = await admin.rpc('record_failed_attempt', {
    p_identifier: ip,
    p_attempt_type: ATTEMPT_TYPE,
    p_ip_address: ip,
  });
  if (recordError) {
    // Do NOT proceed. A send that does not count against the limit makes the
    // limit advisory, and an advisory limit on an anonymous endpoint is none.
    console.error('rate limit record failed', recordError);
    return jsonResponse(req, { error: 'Could not send the message' }, 503);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
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
        `— sent from the contact form at ${req.headers.get('origin') ?? 'unknown origin'}`,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Resend rejected the contact message', data);
    return jsonResponse(req, { error: 'Could not send the message' }, 502);
  }

  return jsonResponse(req, { success: true, id: data.id ?? null }, 200);
});
