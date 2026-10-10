/**
 * A provider reference that cannot be one of our intents must stay QUIET (#1307).
 *
 * Since #1307 a failed lookup throws, and the webhook claim retries a payment-completion event up
 * to MAX_ATTEMPTS before marking it permanently_failed, which turns the daily liveness check red.
 * `payment_intents.id` is a `uuid`, so querying it with a reference that was never ours (a PayPal
 * Invoicing `INV2-...`, another integration's `custom_id`) is a 22P02 error, not an empty result.
 * That is a permanent condition, and without this check it became a retry storm and an alarm.
 */

import { describe, it, expect } from 'vitest';
import { isOurIntentRef } from '../../supabase/functions/_shared/webhook-types';

describe('isOurIntentRef', () => {
  it('accepts the uuid our payment_intents rows carry', () => {
    expect(isOurIntentRef('3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b')).toBe(true);
    expect(isOurIntentRef('3F2B8C1E-9A4D-4E2F-8B6A-1C2D3E4F5A6B')).toBe(true);
  });

  it('refuses references that were never ours', () => {
    for (const ref of [
      'INV2-ABCD-EFGH-IJKL-MNOP', // PayPal Invoicing
      'order-1234', // another integration's custom_id
      'pi_3Pabc', // a Stripe id, not ours
      '3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6', // one digit short
      '',
    ]) {
      expect(isOurIntentRef(ref)).toBe(false);
    }
  });

  it('refuses a missing reference', () => {
    expect(isOurIntentRef(undefined)).toBe(false);
    expect(isOurIntentRef(null)).toBe(false);
    expect(isOurIntentRef(42)).toBe(false);
  });
});
