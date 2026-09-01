/**
 * The Cloudflare-resident configuration this repository intends (#393, #822, #635).
 *
 * WHY A SEPARATE MODULE. Three controls that carry real security weight live in a dashboard
 * rather than in this tree: the cache headers, the CSP header, and the mail DNS. `CLAUDE.md`
 * says it plainly — "the Cloudflare rules live in a dashboard rather than this repo — delete
 * one, rotate the token or move the zone and production silently returns to `max-age=600`."
 *
 * Each of those has a CHECKER that asserts production still matches. What none of them had
 * was a place to say what the intent IS, independent of the code that verifies it, so that
 * the same value can drive both the check and the change. Without that, tightening a policy
 * means editing a dashboard by hand and then editing a checker to agree — two steps, in two
 * systems, with nothing catching a half-done pair.
 *
 * So the intent lives here, once. `check-csp-header.mjs` asserts production matches it, and
 * `cloudflare-apply.mjs` makes production match it. Changing policy is then a one-line diff
 * in a reviewed commit, which is exactly the pattern `check-mail-policy.mjs` already uses for
 * DMARC — see its header for why that is the point rather than an implementation detail.
 *
 * THIS FILE DESCRIBES INTENT, NOT IDENTITY. There are deliberately no zone ids, ruleset ids
 * or rule ids here. Those are discovered at runtime by name and by content, because a fork
 * has different ones and a hardcoded id is the #1014 / #987 failure — template defaults
 * quietly pointing a fork's tooling at the template's infrastructure.
 */

/**
 * Whether the CSP is delivered as a REPORT-ONLY header or an ENFORCING one.
 *
 * `report-only` is deliberate and currently correct. #393 shipped it that way on purpose:
 * enforcing an untested policy breaks sign-up and checkout SILENTLY, and `js.stripe.com`
 * loads both a script and an iframe on `/checkout/` while appearing in neither directive
 * before that work. Report-only is how the missing origins get discovered without an outage.
 *
 * TO FLIP IT: change this to 'enforcing', run `cloudflare-apply.mjs --apply`, and land both
 * in one commit. The checker then requires the enforcing header, so a dashboard revert fails
 * CI instead of passing quietly.
 *
 * Do not flip it without evidence. The header is delivered; whether every origin the site
 * needs is ALLOWED is a different question, and report-only mode is what answers it.
 */
export const CSP_MODE = 'report-only';

/** The response header name each mode is delivered under. */
export const CSP_HEADER = {
  'report-only': 'Content-Security-Policy-Report-Only',
  enforcing: 'Content-Security-Policy',
};

/** The header a CSP rule might be delivered under, in either mode. */
export const CSP_HEADER_NAMES = Object.values(CSP_HEADER);

export function intendedCspHeader(mode = CSP_MODE) {
  const name = CSP_HEADER[mode];
  if (!name)
    throw new Error(
      `unknown CSP mode: ${mode} (expected one of ${Object.keys(CSP_HEADER).join(', ')})`
    );
  return name;
}
