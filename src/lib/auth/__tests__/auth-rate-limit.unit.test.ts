import { describe, it, expect } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import {
  authRateLimitMessage,
  EMAIL_QUOTA_MESSAGE,
  REQUEST_RATE_MESSAGE,
} from '../auth-rate-limit';

/**
 * The real error class, not a hand-built object: what matters is that the shape auth-js throws
 * for a GoTrue 429 is recognised, and a fixture written to match this module would prove only
 * that the two agree with each other.
 */
describe('authRateLimitMessage (#1245)', () => {
  it('names the request ceiling for a GoTrue 429', () => {
    const err = new AuthApiError(
      'Request rate limit reached',
      429,
      'over_request_rate_limit'
    );
    expect(authRateLimitMessage(err)).toBe(REQUEST_RATE_MESSAGE);
  });

  it('names the email quota separately, because waiting minutes will not clear it', () => {
    const err = new AuthApiError(
      'Email rate limit exceeded',
      429,
      'over_email_send_rate_limit'
    );
    expect(authRateLimitMessage(err)).toBe(EMAIL_QUOTA_MESSAGE);
  });

  it('recognises a 429 that carries no code (an older GoTrue)', () => {
    const err = new AuthApiError('Too many requests', 429, undefined);
    expect(authRateLimitMessage(err)).toBe(REQUEST_RATE_MESSAGE);
  });

  it('CONTROL: a wrong password is not a rate limit', () => {
    // Without this, a function returning the message for everything passes the three above.
    const err = new AuthApiError(
      'Invalid login credentials',
      400,
      'invalid_credentials'
    );
    expect(authRateLimitMessage(err)).toBeNull();
  });

  it('leaves a captcha refusal to its own handling', () => {
    const err = new AuthApiError(
      'captcha protection: request disallowed',
      400,
      'captcha_failed'
    );
    expect(authRateLimitMessage(err)).toBeNull();
  });

  it('ignores values that are not errors', () => {
    expect(authRateLimitMessage(null)).toBeNull();
    expect(authRateLimitMessage(undefined)).toBeNull();
    expect(authRateLimitMessage('429')).toBeNull();
    expect(authRateLimitMessage(new Error('network down'))).toBeNull();
  });
});
