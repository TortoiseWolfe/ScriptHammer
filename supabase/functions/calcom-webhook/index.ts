/**
 * A booking happened, and the lead that led to it becomes `scheduled` (#562 T037, T039).
 *
 * NO CORS, DELIBERATELY. This is server-to-server: Cal.com POSTs here directly. Importing
 * `_shared/cors.ts` would be wrong for the same reason it is required in `create-lead` — a
 * browser never calls this, and advertising an allowed origin for something no browser
 * should reach only widens what can talk to it.
 *
 * THE STATUS CODES ARE THE CONTRACT, and getting them backwards causes retry storms:
 *
 *   400  the signature did not verify. Not ours, or misconfigured. Never retried.
 *   200  { handled: false, reason } — a real delivery this system has nothing to do about:
 *        a trigger we do not subscribe to, a booking with no lead_ref, an unknown lead, or
 *        a redelivery we have already processed. All of these are NORMAL.
 *   409  another delivery of this booking holds the claim right now (#1307). Retry later.
 *   500  reserved for our own failure, where a retry might genuinely help. After
 *        MAX_ATTEMPTS failures the event is marked permanently_failed and answered 200.
 *
 * A booking made straight from a Cal.com link that never touched this site carries no
 * `lead_ref`, and that is an ordinary thing for somebody to do. Answering it with an error
 * would make the operator's webhook log red for people booking calls correctly.
 *
 * IDEMPOTENCY IS A CLAIM ON THE LEDGER, not a read-then-write (`_shared/webhook-claim.ts`,
 * #1307). `webhook_events` has a unique `(provider, provider_event_id)`, so a second delivery
 * of the SAME booking loses the insert race. If the first was processed it is answered 200;
 * if the first FAILED, the second reclaims it and runs the lead update again. That is safe
 * only because the lead update is a compare-and-swap, which is also what makes two DIFFERENT
 * events describing one booking harmless. Before #1307 a failed first attempt was answered
 * "already processed" on every retry, and the lead stayed unscheduled.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  SIGNATURE_HEADER,
  resolveBooking,
  verifySignature,
} from './resolve.ts';
import {
  claimWebhookEvent,
  failWebhookEvent,
  finishWebhookEvent,
} from '../_shared/webhook-claim.ts';

const SECRET = Deno.env.get('CALCOM_WEBHOOK_SECRET') ?? '';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // READ THE BODY ONCE, AS TEXT. The signature covers the exact bytes received; parsing and
  // re-serialising reorders keys and produces a different digest.
  const raw = await req.text();

  const signature = req.headers.get(SIGNATURE_HEADER);
  const verdict = await verifySignature(raw, SECRET, signature);
  if (!verdict.ok) {
    console.warn('calcom-webhook rejected a delivery', {
      reason: verdict.reason,
    });
    return json({ error: 'Invalid signature' }, 400);
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const outcome = resolveBooking(event as never);
  if (outcome.kind === 'ignored') {
    return json({ handled: false, reason: outcome.reason }, 200);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // CLAIM BEFORE HANDLING (#1307). A redelivery of a booking whose lead update failed is handled
  // again (the update is a compare-and-swap, so that is safe) instead of being answered "already
  // processed" while the lead stays unscheduled. See _shared/webhook-claim.ts.
  let claim;
  try {
    claim = await claimWebhookEvent(admin, 'calcom', {
      provider_event_id: outcome.eventId,
      event_type: 'BOOKING_CREATED',
      event_data: event,
      signature: signature ?? '',
    });
  } catch (claimError) {
    console.error('calcom-webhook could not record the event', claimError);
    return json({ error: 'Could not record the event' }, 500);
  }
  if (claim.kind === 'respond') {
    return json({ handled: false, reason: claim.message }, claim.status);
  }

  if (outcome.kind === 'unattributed') {
    try {
      await finishWebhookEvent(admin, claim.id, claim.attempt);
    } catch (finishError) {
      console.error(
        'calcom-webhook could not mark the event processed',
        finishError
      );
      return json({ error: 'Could not record the event' }, 500);
    }
    return json({ handled: false, reason: outcome.reason }, 200);
  }

  // ONLY A LEAD STILL AT `link_opened` IS ADVANCED. Compare-and-swap, the same shape as
  // `advance-order`: it makes a second, different event describing the same booking harmless,
  // and it means a lead an operator has already moved on is never dragged backwards.
  const { data: updated, error: updateError } = await admin
    .from('leads')
    .update({
      status: 'scheduled',
      name: outcome.name,
      email: outcome.email,
      scheduled_at: outcome.scheduledAt,
      booking_ref: outcome.eventId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', outcome.leadRef)
    .eq('status', 'link_opened')
    .select('id');

  if (updateError) {
    console.error('calcom-webhook could not advance the lead', updateError);
    const failed = await failWebhookEvent(
      admin,
      claim.id,
      claim.attempt,
      true,
      updateError
    );
    return json(
      { error: 'Could not advance the lead', gave_up: failed.giveUp },
      failed.status
    );
  }

  try {
    await finishWebhookEvent(admin, claim.id, claim.attempt);
  } catch (finishError) {
    console.error(
      'calcom-webhook could not mark the event processed',
      finishError
    );
    return json({ error: 'Could not record the event' }, 500);
  }

  const advanced = (updated ?? []).length > 0;
  return json(
    advanced
      ? { handled: true, lead: outcome.leadRef }
      : {
          // The id was well-formed but matched no lead at `link_opened` — an unknown id, or
          // one already advanced. Both are normal and neither is worth a retry.
          handled: false,
          reason: 'no lead awaiting this booking',
        },
    200
  );
});
