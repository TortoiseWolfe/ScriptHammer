/**
 * Kid-safe routes.
 *
 * A page aimed at children falls under COPPA's "directed to children" factors
 * (16 CFR 312.2): every visitor is treated as under 13, and a cookie banner is
 * not a parent's consent. On these routes no tracker may load and no event may
 * be sent, whatever the visitor accepted on another page.
 *
 * ONE list, read by every tracker: GoogleAnalytics, OpenAIPixel, SentryMonitor
 * and the gtag helpers in `utils/analytics.ts`. A tracker added later reads it
 * too; `kid-safe-routes.test.ts` fails if one of the existing four stops.
 *
 * Paths here carry no basePath and no trailing slash. A listed route covers
 * its sub-paths.
 */
export const KID_SAFE_ROUTES: readonly string[] = ['/band'];

function stripBasePath(pathname: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    return pathname.slice(base.length) || '/';
  }
  return pathname;
}

/**
 * True when `pathname` is a kid-safe route. Tolerates a trailing slash and a
 * leading basePath, so both `usePathname()` and `window.location.pathname`
 * can be passed straight in.
 */
export function isKidSafeRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = stripBasePath(pathname).replace(/\/+$/, '') || '/';
  return KID_SAFE_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}

/**
 * True when the page the visitor is looking at right now is kid-safe. Reads
 * `window.location`, not React state, because a tracker that finished loading
 * on a previous page keeps running after a client-side navigation.
 */
export function isKidSafeLocation(): boolean {
  if (typeof window === 'undefined') return false;
  return isKidSafeRoute(window.location.pathname);
}
