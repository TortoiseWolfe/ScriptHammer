import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  getEmailHtml,
  getEmailSubject,
  getEmailText,
} from '../../supabase/functions/_shared/email-templates';

/**
 * Payment emails must carry the payment's facts (#610).
 *
 * These run under vitest without Deno for the same reason
 * `create-order-resolve.test.ts` can: `email-templates.ts` imports nothing.
 *
 * THE ASSERTION THAT MATTERS IS "THE VALUE APPEARS". The bug being fixed was a template
 * that accepted `data` and never read it, returning a fixed string. Every half of the
 * system reported success — the function returned HTML, Resend answered 200 — so a test
 * asserting "returns a non-empty string", or even "contains <html>", would have passed
 * against the stub for as long as it existed. #610 says this explicitly, and it is the
 * reason each case below asserts on the DATA, not on the shape.
 */

const successData = {
  amount: 2500,
  currency: 'usd',
  description: 'Landing page build',
  order_id: 'ord_12345',
};

describe('payment email templates carry the payment (#610)', () => {
  it('renders amount, item and order id into the HTML', () => {
    const html = getEmailHtml('payment_success', successData);

    expect(html).toContain('$25.00');
    expect(html).toContain('Landing page build');
    expect(html).toContain('ord_12345');
  });

  it('renders the same facts into the text part', () => {
    // A text part that says less than the HTML is what plain-text clients actually show.
    const text = getEmailText('payment_success', successData);

    expect(text).toContain('$25.00');
    expect(text).toContain('Landing page build');
    expect(text).toContain('ord_12345');
  });

  it('formats cents as currency, not as an integer', () => {
    // `payment_intents.amount` and `orders.amount_charged` are INTEGER cents. A receipt
    // reading "2500" where the card statement reads $25.00 is worse than no receipt.
    expect(formatAmount(2500, 'usd')).toBe('$25.00');
    expect(formatAmount(99, 'usd')).toBe('$0.99');
    expect(formatAmount(120000, 'eur')).toBe('€1200.00');
    expect(formatAmount(500, 'cad')).toBe('5.00 CAD');

    // Non-numeric input must not become "NaN" on a receipt.
    expect(formatAmount(undefined)).toBeNull();
    expect(formatAmount('not a number')).toBeNull();
  });

  it('escapes values rather than injecting them', () => {
    // `data` comes from a payment webhook, so a description is attacker-influencable in
    // the general case. Unescaped, it would land in the recipient's mail client.
    const html = getEmailHtml('payment_success', {
      ...successData,
      description: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('omits fields it does not have instead of printing "undefined"', () => {
    const html = getEmailHtml('payment_success', {
      amount: 1000,
      currency: 'usd',
    });
    const text = getEmailText('payment_success', {
      amount: 1000,
      currency: 'usd',
    });

    expect(html).toContain('$10.00');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(text).not.toContain('undefined');
  });

  it('says so plainly when it has no details at all', () => {
    // An empty table reads as a broken email; a caller sending `{}` is a real
    // possibility and should produce something honest rather than an empty shell.
    const html = getEmailHtml('payment_success', {});

    expect(html).toContain('not available');
    expect(html).not.toContain('undefined');
  });

  it('carries the per-type facts: interval for subscriptions, reason for failures', () => {
    const sub = getEmailText('subscription_created', {
      amount: 900,
      currency: 'usd',
      interval: 'month',
    });
    expect(sub).toContain('$9.00');
    expect(sub).toContain('month');

    const failed = getEmailText('payment_failure', {
      amount: 4200,
      currency: 'usd',
      failure_reason: 'card_declined',
    });
    expect(failed).toContain('card_declined');
  });

  it('reads the field under any of the column names it can arrive as', () => {
    // No in-repo caller pins the payload shape, and the value can come from
    // `payment_intents` (amount, description) or `orders` (amount_charged, product_id).
    // Reading only one spelling would render an empty email for the other caller.
    const fromOrders = getEmailText('payment_success', {
      amount_charged: 7500,
      currency: 'usd',
      product_id: 'svc-landing',
      intent_id: 'pi_999',
    });

    expect(fromOrders).toContain('$75.00');
    expect(fromOrders).toContain('svc-landing');
    expect(fromOrders).toContain('pi_999');
  });

  it('still gives every type a subject', () => {
    expect(getEmailSubject('payment_success')).toBe('Payment Successful');
    expect(getEmailSubject('payment_failure')).toBe('Payment Failed');
    expect(getEmailSubject('subscription_created')).toBe(
      'Subscription Activated'
    );
    expect(getEmailSubject('something_else')).toBe('Payment Notification');
  });
});
