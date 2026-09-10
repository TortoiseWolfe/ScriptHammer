/**
 * If `/checkout` promises terms before payment, the checkout path must actually show some.
 *
 * WHAT HAPPENED (#561 T034). `src/app/checkout/page.tsx` has told buyers "Terms are shown
 * before payment" since before #613. Nothing on that path showed any. `CheckoutSummary`,
 * `IntakeForm` and `BookingStep` between them contained zero occurrences of terms, cancel
 * or refund, and the app's ONLY link to `/terms` lived inside `PaymentConsentModal` — a
 * GDPR script-consent gate that renders only until consent is granted, and which the
 * signed-out branch of checkout never renders at all. So the promise was true of nothing a
 * buyer could reach, on the one page in the product where being wrong costs money.
 *
 * WHY A GUARD AND NOT JUST A FIX. The sentence and the content live in different files, and
 * the last person to edit the sentence fixed half of it: #613 corrected "No account needed"
 * in the same paragraph and left the terms half standing. Two files that must agree, with
 * nothing making them, is the shape that already failed once here.
 *
 * WHY IT STRIPS COMMENTS FIRST. This repo has been bitten four times in one session by a
 * guard that matched its OWN prose (`lesson_guard_matches_its_own_prose`), and this file is
 * a live instance: `checkout/page.tsx` now carries a comment quoting the promise verbatim,
 * so a naive grep would find the promise in a file whose rendered output had none. The
 * comment stripper is therefore load-bearing, and one of the cases below proves it works by
 * counting matches rather than trusting it.
 *
 * WHAT IT DOES NOT CATCH, said plainly: whether the terms are TRUE, whether they match
 * `/terms`, or whether a buyer understands them. It checks that the promise is not empty.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const CHECKOUT = path.join(ROOT, 'src', 'app', 'checkout', 'page.tsx');
const SUMMARY = path.join(
  ROOT,
  'src',
  'components',
  'payment',
  'CheckoutSummary',
  'CheckoutSummary.tsx'
);

/**
 * Source with comments removed, so a guard reads what SHIPS rather than what is explained.
 *
 * Block comments cover JSX's `{/* … *\/}` too — what is left behind is an empty `{}`, which
 * renders nothing and matches nothing. Line comments are only stripped when `//` is not
 * preceded by `:`, so `https://` survives intact.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** JSX wraps prose across lines; a reader sees one sentence, so compare one sentence. */
function flatten(src) {
  return src.replace(/\s+/g, ' ');
}

const PROMISE = /Terms are shown before payment/g;

/** Does the checkout page make the promise, in rendered output rather than in a comment? */
function promiseCount(checkoutSrc) {
  return (flatten(stripComments(checkoutSrc)).match(PROMISE) ?? []).length;
}

/** Everything that makes the promise good: real terms prose plus a route to the full text. */
function backing(summarySrc) {
  const flat = flatten(stripComments(summarySrc));
  return {
    // Three separate subjects, so a single stray word cannot satisfy the whole rule.
    refund: /refund/i.test(flat),
    cancel: /cancel/i.test(flat),
    renew: /renew/i.test(flat),
    // BARE href. next/link prepends the basePath itself, so `getInternalUrl('/terms')`
    // would double-prefix it — the trap PaymentConsentModal.test.tsx pins for /privacy (#159).
    termsLink: /href="\/terms"/.test(flat),
    helperLink: /getInternalUrl\(\s*['"]\/terms['"]\s*\)/.test(flat),
  };
}

describe('checkout shows the terms it promises (#561 T034)', () => {
  it('finds the promise in rendered output, so the guard is not vacuous', () => {
    // ANTI-VACUITY. If the path broke or the sentence were reworded, every assertion below
    // would pass by inspecting nothing — the same silent green the defect itself had.
    const count = promiseCount(fs.readFileSync(CHECKOUT, 'utf8'));
    assert.strictEqual(
      count,
      1,
      `expected exactly one rendered "Terms are shown before payment" in ${path.relative(ROOT, CHECKOUT)}, ` +
        `found ${count}. Zero means the guard has gone blind (reworded sentence, moved file); ` +
        'more than one means the comment stripper stopped working and it is now reading prose.'
    );
  });

  it('strips comments rather than matching them', () => {
    // The stripper is the load-bearing part: checkout/page.tsx quotes the promise inside a
    // comment, so an unstripped read finds it twice and would stay green with the rendered
    // sentence deleted. Prove the raw file really does contain the decoy.
    const raw = flatten(fs.readFileSync(CHECKOUT, 'utf8'));
    const rawCount = (raw.match(PROMISE) ?? []).length;
    assert.ok(
      rawCount > 1,
      'the decoy is gone: this file no longer quotes the promise in a comment, so the ' +
        'comment-stripping case below proves nothing. Point it at another commented ' +
        'occurrence or delete it — do not leave it asserting on an empty set.'
    );
  });

  it('backs the promise with real terms and a route to the full text', () => {
    const b = backing(fs.readFileSync(SUMMARY, 'utf8'));
    const missing = ['refund', 'cancel', 'renew', 'termsLink'].filter(
      (k) => !b[k]
    );

    assert.deepStrictEqual(
      missing,
      [],
      'CheckoutSummary is the only component rendered on BOTH branches of /checkout, and the ' +
        'page promises terms before payment. It must therefore carry cancellation, refund and ' +
        'renewal wording plus a link to /terms.\n\n' +
        'If you moved the terms elsewhere on the checkout path, point this guard at the new ' +
        'home — do not delete it. The promise sat unbacked from before #613 until #561 T034 ' +
        'precisely because nothing connected the sentence to the content.\n\n' +
        `Missing: ${missing.join(', ')}`
    );

    assert.strictEqual(
      b.helperLink,
      false,
      'The /terms link must be a bare href. next/link prepends the runtime basePath, so ' +
        'getInternalUrl() prepends it a second time (#159).'
    );
  });

  it('goes red when the terms are removed', () => {
    // COUNTERWEIGHT, and the only part that proves the rule can fail. A guard nobody has
    // watched fail is a guard nobody knows the shape of.
    const mutated = fs
      .readFileSync(SUMMARY, 'utf8')
      .replace(/export function cancellationTerms[\s\S]*?\n}\n/, '\n')
      .replace(/<section[\s\S]*?<\/section>/, '');

    const b = backing(mutated);
    assert.ok(
      !b.refund && !b.termsLink,
      'the mutation did not apply — it deleted neither the terms function nor the rendered ' +
        'section, so this case passes over untouched code. Fix the mutation, not the assertion.'
    );
  });
});
