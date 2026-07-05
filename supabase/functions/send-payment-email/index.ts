import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  getEmailSubject,
  getEmailHtml,
  getEmailText,
} from '../_shared/email-templates.ts';

const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

/**
 * Constant-time string comparison. Avoids a timing side-channel on the
 * service-role key and — unlike String.includes — requires an EXACT match
 * (a substring or an `undefined`-coerced check would let unauthorized
 * callers through and send arbitrary emails from this domain).
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  // Compare against a fixed-length accumulator so length differences don't
  // short-circuit (which would itself leak length via timing).
  let mismatch = bufA.length === bufB.length ? 0 : 1;
  const len = Math.max(bufA.length, bufB.length);
  for (let i = 0; i < len; i++) {
    mismatch |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return mismatch === 0;
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Require an exact `Bearer <service-role-key>` match. Guard the env var:
    // if it were unset, any non-constant-time substring check could be
    // bypassed (e.g. includes(undefined) → includes("undefined")).
    const bearerPrefix = 'Bearer ';
    const presentedToken =
      authHeader && authHeader.startsWith(bearerPrefix)
        ? authHeader.slice(bearerPrefix.length).trim()
        : '';

    if (
      !serviceRoleKey ||
      !presentedToken ||
      !timingSafeEqual(presentedToken, serviceRoleKey)
    ) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    let emailData;
    try {
      emailData = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { type, recipient, data } = emailData;

    if (!type || !recipient || !data) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: type, recipient, data',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const subject = getEmailSubject(type);
    const html = getEmailHtml(type, data);
    const text = getEmailText(type, data);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'ScriptHammer <noreply@scripthammer.com>',
        to: [recipient],
        subject: subject,
        html: html,
        text: text,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: resendData }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ sent: true, email_id: resendData.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Email notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
