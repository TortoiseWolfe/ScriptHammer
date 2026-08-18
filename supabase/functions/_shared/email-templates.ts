/**
 * Payment notification emails (#610).
 *
 * WHAT THIS REPLACES. `getEmailHtml` and `getEmailText` accepted `data` and never read it.
 * The entire body of every payment email was "Payment Notification / Type:
 * payment_success" — no amount, no product, no order id, nothing to reconcile against a
 * card statement. Both halves reported success the whole time: the function returned a
 * string and Resend answered 200, so nothing anywhere said the email was empty.
 *
 * WHY TABLES AND INLINE STYLES. Email clients are not browsers. Outlook's rendering
 * engine has no CSS custom properties and no grid, which is exactly what the pricing page
 * is built from — so the site's styles cannot be reused here, and a `<div>` layout that
 * looks right in a browser preview can collapse in a real inbox.
 *
 * WHY EVERY VALUE IS ESCAPED. `data` arrives from a payment webhook, and a product
 * description or promo code is attacker-influencable in the general case. An unescaped
 * interpolation would put whatever it contains into the recipient's mail client.
 *
 * AMOUNTS ARE CENTS. `payment_intents.amount` and `orders.amount_charged` are INTEGER
 * cents (see the monolithic migration). Rendering the raw value would show "2500" where
 * the customer paid $25.00 — a receipt that disagrees with the card statement is worse
 * than no receipt.
 *
 * The `data` shape is deliberately tolerant: no in-repo caller pins it, so each field is
 * read through a small list of aliases matching the columns it could come from
 * (`payment_intents` or `orders`). A field that is absent is OMITTED rather than rendered
 * as "undefined" — an email that quietly says less is recoverable; one that says
 * "undefined" is not.
 */

export function getEmailSubject(type: string): string {
  const subjects: Record<string, string> = {
    payment_success: 'Payment Successful',
    payment_failure: 'Payment Failed',
    subscription_created: 'Subscription Activated',
  };
  return subjects[type] || 'Payment Notification';
}

/** Escape the five characters that matter in an HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** First present, non-empty value among the given keys. */
function pick(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data?.[key];
    if (value === null || value === undefined || value === '') continue;
    return String(value);
  }
  return null;
}

/**
 * Cents to a human amount: `2500, 'usd'` -> `$25.00`.
 *
 * Falls back to `25.00 USD` for currencies without a symbol here rather than guessing,
 * and returns null on a non-numeric amount so the row is omitted instead of rendering
 * "NaN" onto a receipt.
 */
export function formatAmount(
  cents: unknown,
  currency: unknown = 'usd'
): string | null {
  const n = typeof cents === 'string' ? Number(cents) : cents;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;

  const code = String(currency || 'usd').toUpperCase();
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
  const value = (n / 100).toFixed(2);
  return symbols[code] ? `${symbols[code]}${value}` : `${value} ${code}`;
}

/** The facts an email carries, in display order. Absent fields are dropped. */
function facts(
  type: string,
  data: Record<string, unknown>
): [string, string][] {
  const rows: [string, string | null][] = [
    [
      'Amount',
      formatAmount(
        pick(data, 'amount', 'amount_charged'),
        pick(data, 'currency') ?? 'usd'
      ),
    ],
    ['Item', pick(data, 'product_name', 'description', 'product_id')],
    ['Order', pick(data, 'order_id', 'id', 'intent_id')],
  ];

  if (type === 'subscription_created') {
    const interval = pick(data, 'interval');
    if (interval) rows.push(['Billing', `every ${interval}`]);
  }
  if (type === 'payment_failure') {
    rows.push(['Reason', pick(data, 'failure_reason', 'error', 'reason')]);
  }

  return rows.filter((r): r is [string, string] => r[1] !== null);
}

/** The one-line summary above the table. */
function headline(type: string): string {
  const lines: Record<string, string> = {
    payment_success: 'Thank you — your payment went through.',
    payment_failure: 'Your payment could not be completed.',
    subscription_created: 'Your subscription is active.',
  };
  return lines[type] || 'Here are the details of your payment.';
}

export function getEmailHtml(type: string, data: Record<string, any>): string {
  const rows = facts(type, data ?? {})
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:6px 12px 6px 0;color:#555;font-size:14px;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>` +
        `</tr>`
    )
    .join('');

  // No details at all is a real possibility (a caller sending `{}`), and an empty table
  // reads as a broken email. Say so plainly instead.
  const body = rows
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}</table>`
    : `<p style="color:#555;font-size:14px;">Details are not available for this notification.</p>`;

  return (
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;` +
    `font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
    `<tr><td align="center">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" ` +
    `style="max-width:560px;background:#ffffff;border-radius:8px;padding:24px;">` +
    `<tr><td>` +
    `<h1 style="margin:0 0 8px;font-size:20px;color:#111;">${escapeHtml(getEmailSubject(type))}</h1>` +
    `<p style="margin:0 0 16px;font-size:15px;color:#333;">${escapeHtml(headline(type))}</p>` +
    body +
    `</td></tr></table>` +
    `</td></tr></table></body></html>`
  );
}

export function getEmailText(type: string, data: Record<string, any>): string {
  // The SAME facts as the HTML part. A text part that says less is what a plain-text
  // client and most accessibility tooling actually shows.
  const rows = facts(type, data ?? {}).map(
    ([label, value]) => `${label}: ${value}`
  );
  const lines = [getEmailSubject(type), '', headline(type)];
  if (rows.length) lines.push('', ...rows);
  else lines.push('', 'Details are not available for this notification.');
  return lines.join('\n');
}
