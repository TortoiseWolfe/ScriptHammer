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
 * NOT YET DONE, stated so it is not mistaken for complete: there is no rate limit.
 * The fixed recipient bounds the blast radius to our own mailbox rather than a
 * stranger's, which is the difference between nuisance and the #353 defect — but a
 * per-IP limit still belongs here. Tracked in #784.
 */

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
