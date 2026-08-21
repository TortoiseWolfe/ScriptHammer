/**
 * The admin console's sections — the single definition the nav renders and the E2E
 * navigation test enumerates (#912).
 *
 * WHY THIS IS NOT INSIDE AdminGate.tsx ANY MORE. It used to be a module-private const
 * there, so `tests/e2e/admin/admin-dashboard.spec.ts` restated it as a hardcoded array.
 * The two drifted: the test's list had six entries, the nav had seven, and `/admin/email`
 * was never visited by a test named "should navigate between all admin tabs". `Orders` had
 * been added to both; `Email` was added to one. Nothing failed, because nothing compared
 * them.
 *
 * A pure data module — no React, no CSS — so a Playwright spec can import it directly, the
 * way `@/config/themes` and `@/config/touch-targets` already are.
 *
 * ADDING A SECTION: add it here. The nav renders it and the E2E test visits it, with no
 * second list to remember.
 */
export const ADMIN_SECTIONS = [
  { href: '/admin', label: 'Overview', title: 'Admin Dashboard' },
  // Title is 'Payment Activity', not 'Payments' — that is the text the page
  // already shipped, and admin-dashboard.spec.ts matches a heading against
  // /payment/i. Renaming it here would have been a silent copy change.
  { href: '/admin/payments', label: 'Payments', title: 'Payment Activity' },
  { href: '/admin/orders', label: 'Orders', title: 'Orders' },
  { href: '/admin/audit', label: 'Audit Trail', title: 'Audit Trail' },
  { href: '/admin/users', label: 'Users', title: 'User Management' },
  { href: '/admin/messaging', label: 'Messaging', title: 'Messaging Overview' },
  { href: '/admin/email', label: 'Email', title: 'Email Provider Health' },
] as const;

/**
 * The floor the E2E test asserts before looping.
 *
 * Enumeration alone is not enough: if the import ever resolved to an empty array the loop
 * would run zero times and the test would still pass, which is the defect one level up.
 * Raise this when sections are added; never lower it to make a run pass (#411).
 */
export const ADMIN_SECTION_FLOOR = 7;
