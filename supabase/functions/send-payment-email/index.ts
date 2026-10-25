import { errorMessage } from '../_shared/webhook-types.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { timingSafeEqual } from '../_shared/timing-safe-equal.ts';
import {
  getEmailSubject,
  getEmailHtml,
  getEmailText,
} from '../_shared/email-templates.ts';

const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

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
      JSON.stringify({ error: errorMessage(error) || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
