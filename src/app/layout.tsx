import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PRELOAD_FONTS } from './fonts-preload.generated';
import ThemeScript from '@/components/ThemeScript';
import AccessibilityScript from '@/components/AccessibilityScript';
import StylesheetGuard from '@/components/subatomic/StylesheetGuard';
import PaymentQueueSync from '@/components/payment/PaymentQueueSync';
import { GlobalNav } from '@/components/GlobalNav';
import { Footer } from '@/components/Footer';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import { ColorblindFilters } from '@/components/atomic/ColorblindFilters';
import { ConsentProvider } from '@/contexts/ConsentContext';
import { CookieConsent } from '@/components/privacy/CookieConsent';
import { ConsentModal } from '@/components/privacy/ConsentModal';
import GoogleAnalytics from '@/lib/analytics/GoogleAnalytics';
import SentryMonitor from '@/lib/monitoring/SentryMonitor';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { projectConfig } from '@/config/project.config';
import {
  generateMetadata,
  generateJsonLd,
  JsonLdScript,
} from '@/utils/metadata';
import PWAInstall from '@/components/PWAInstall';
import { CountdownBanner } from '@/components/atomic/CountdownBanner';
import { SetupBanner } from '@/components/SetupBanner';
import A11yDevOverlay from '@/components/organisms/A11yDevOverlay';

/**
 * The 2a "Machine Shop" type stack (#377).
 *
 * Declaring the face here is only step one of three. A `next/font` variable
 * that no CSS rule references paints nothing — which is exactly what Geist did
 * on every page of this site before #377: downloaded, self-hosted, and
 * rendered nowhere, because `@theme` never mapped it to `--font-sans` and the
 * accessibility provider overwrote `body`'s font with an inline style anyway.
 *
 * The other two steps are the `--font-sans` / `--font-mono` / `--font-display`
 * mapping in globals.css `@theme`, and `FONT_FAMILIES` in
 * `@/config/accessibility-tokens`. Change one without the others and the font
 * silently does not apply.
 */
// FONT FACES ARE VENDORED (#730). The @font-face declarations live in
// src/app/fonts.generated.css and the --font-* variables in globals.css :root, so the
// build no longer fetches from fonts.gstatic.com. Regenerate with
// `node scripts/fonts/vendor-google-fonts.mjs` after changing a family, weight or subset.

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // viewport-fit=cover lets the app draw into the iOS safe-area insets and makes
  // env(safe-area-inset-*) non-zero, so safe-area padding (e.g. the messaging
  // input row, #30 fix #1) actually clears the home indicator. Without this,
  // env() resolves to 0 and the padding is a no-op.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f0eb' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],
};

// Generate comprehensive metadata using the utility function
export const metadata: Metadata = {
  // NO `path` HERE, DELIBERATELY (#668).
  //
  // Metadata set on the root layout is inherited by every route that does not
  // override it, and `alternates.canonical` is no exception. Passing `path: '/'`
  // here was correct for the root document and catastrophic for everything under
  // it: 83 of 100 routes shipped `<link rel="canonical" href="https://scripthammer.com/">`,
  // which asks Google to index the homepage *instead of* that page. `/pricing`,
  // `/docs`, `/blog` and 80 others were each requesting their own removal.
  //
  // The homepage now claims `/` in `src/app/page.tsx`, where it belongs. Routes
  // that claim nothing emit no canonical, which is the safe default.
  ...generateMetadata({
    title: projectConfig.projectName,
    description: projectConfig.projectDescription,
    tags: ['Next.js', 'React', 'TypeScript', 'PWA', 'DaisyUI', 'TailwindCSS'],
  }),
  manifest: projectConfig.manifestPath,
  icons: {
    icon: ['/favicon.ico', '/icon.svg'],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: projectConfig.projectName,
  },
  other: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    // NO Content-Security-Policy HERE, deliberately (#393).
    //
    // It used to live in this object, and `metadata.other` renders
    // `<meta name="...">`. A CSP delivered as `<meta name>` is INERT — browsers
    // honour only `<meta http-equiv>` or the HTTP header. So for the whole life
    // of that entry the policy was authored, reviewed and maintained, and never
    // once enforced: a control whose presence was asserted and whose effect
    // never was.
    //
    // The policy is now a real response header, set by a Cloudflare Response
    // Header Transform Rule on the zone — the same mechanism #635 used for
    // cache-control, and available for the same reason (Cloudflare fronts
    // GitHub Pages, which cannot set headers itself).
    //
    // IT LIVES IN A DASHBOARD, NOT IN THIS TREE, exactly like the cache rules.
    // Delete the rule, rotate the token or move the zone and the policy silently
    // disappears with nothing here to notice — which is why
    // `scripts/ci/check-csp-header.mjs` asserts it against LIVE production in
    // smoke.yml. That check is the only thing that can see the cure.
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables go on <html>, NOT <body>, and that placement is
    // load-bearing (#377). A custom property resolves in the scope where it is
    // DECLARED. `@theme` emits `--font-sans: var(--font-archivo)` onto :root,
    // and AccessibilityScript sets `--sh-font-body` on documentElement — both
    // are <html>. With the classes on <body>, `--font-archivo` was defined one
    // level too deep for either to see, so both silently fell through to their
    // ui-sans-serif fallback while the font downloaded perfectly.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * Start the font fetch from the HTML rather than from CSS parsing (#740).
         *
         * `next/font` emitted these until the faces were vendored (#730); without them the
         * browser must parse the stylesheet and reach layout before it discovers a face.
         * Nothing broke — `swap` and the metric-matched fallbacks mean no layout shift —
         * but on a cold connection the swap happens later than it needs to.
         *
         * `crossOrigin` is REQUIRED even though these are same-origin: fonts are fetched in
         * CORS mode, and a preload without it is a different cache entry from the one the
         * CSS later requests, so the file downloads twice and the preload is worse than
         * nothing.
         */}
        {PRELOAD_FONTS.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body
        className="flex min-h-screen flex-col antialiased"
        suppressHydrationWarning
      >
        <ThemeScript />
        <AccessibilityScript />
        {/* Recovers a visitor holding cached HTML whose stylesheets were deleted
            by a later deploy (#650) — the white-page-with-a-giant-logo failure
            reported from production six times. Waits for `load`, so it costs
            nothing on a healthy page. */}
        <StylesheetGuard />
        {/* Drains the offline payment queue when connectivity returns (#895).
            Renders nothing. It lives HERE rather than on the payment pages
            because the case it exists for is a payment queued and then
            navigated away from — a drain scoped to the checkout route would
            miss exactly that. Mounted ONCE: the listener is a module-level
            singleton, and a second mount hands back a stop function that
            disarms the first. */}
        <PaymentQueueSync />
        <JsonLdScript data={generateJsonLd()} />
        <ColorblindFilters />
        <ConsentProvider>
          <GoogleAnalytics />
          <SentryMonitor />
          <AuthProvider>
            <AccessibilityProvider>
              {/* WCAG 2.4.1 Bypass Blocks. It lives HERE, not on a page (#475).
                  It used to exist on `/` alone, so on every other route a
                  keyboard or screen-reader user traversed the whole nav — 13
                  destinations plus the Display panel — before reaching content,
                  on every navigation.

                  `focus:fixed` rather than `focus:absolute`: <body> is not
                  positioned, so an absolutely-positioned link resolves against
                  the initial containing block and scrolls away with the page.
                  Fixed keeps it on screen wherever focus arrives from.

                  data-skip-link is what tests/e2e/landmarks.spec.ts matches on.
                  Do NOT let a gate identify this by "first in-page anchor" —
                  on a blog post that is a table-of-contents entry, which is
                  how #475's original probe nearly filed a false report. */}
              <a
                href="#main-content"
                data-skip-link
                className="btn btn-sm btn-primary sr-only min-h-11 min-w-11 focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
              >
                Skip to main content
              </a>
              <GlobalNav />
              <CountdownBanner />
              <SetupBanner />
              <ErrorBoundary level="page">
                {/* The skip TARGET. tabIndex={-1} so the anchor jump actually
                    moves focus here — without it the browser scrolls and leaves
                    focus on the link, and the next Tab returns to the nav.
                    Not itself a <main>: 32 pages render their own, and nesting
                    or duplicating the landmark is worse than not having it. */}
                <div
                  id="main-content"
                  tabIndex={-1}
                  className="bg-base-200 min-h-0 flex-1 overflow-x-clip"
                >
                  {children}
                </div>
              </ErrorBoundary>
              <Footer />
              <CookieConsent />
              <ConsentModal />
              <PWAInstall />
              {process.env.NODE_ENV === 'development' && <A11yDevOverlay />}
            </AccessibilityProvider>
          </AuthProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
