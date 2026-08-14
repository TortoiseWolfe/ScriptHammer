import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeScript from '@/components/ThemeScript';
import AccessibilityScript from '@/components/AccessibilityScript';
import StylesheetGuard from '@/components/subatomic/StylesheetGuard';
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
  ...generateMetadata({
    title: projectConfig.projectName,
    description: projectConfig.projectDescription,
    path: '/',
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
    // Content Security Policy via meta tag (for static export compatibility)
    // Note: HTTP headers are preferred but not available with static export
    'Content-Security-Policy': [
      "default-src 'self'",
      // challenges.cloudflare.com: the Turnstile sign-up CAPTCHA (#353). It
      // needs all three of script-src (the api.js loader), frame-src (the
      // challenge runs in an iframe) and connect-src (the widget calls home).
      // Miss any one and the widget fails SILENTLY in prod — the CSP ships as a
      // meta tag here because static export has no response headers.
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://www.googleapis.com https://*.google-analytics.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.supabase.co wss://*.supabase.co https://*.basemaps.cartocdn.com https://api.web3forms.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://challenges.cloudflare.com",
      "frame-src 'self' https://www.google.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://api.web3forms.com",
      'upgrade-insecure-requests',
    ].join('; '),
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
