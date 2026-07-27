import type { Metadata, Viewport } from 'next';
import { Archivo, Archivo_Black, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ThemeScript from '@/components/ThemeScript';
import AccessibilityScript from '@/components/AccessibilityScript';
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
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  preload: true,
  fallback: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ],
});

/** Display face: headings only. Single weight — Archivo Black ships only 400. */
const archivoBlack = Archivo_Black({
  variable: '--font-archivo-black',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  preload: true,
  fallback: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Arial',
    'sans-serif',
  ],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  preload: true,
  fallback: [
    '"SF Mono"',
    'Monaco',
    '"Inconsolata"',
    '"Fira Mono"',
    '"Droid Sans Mono"',
    '"Source Code Pro"',
    'monospace',
  ],
});

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
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-screen flex-col antialiased"
        suppressHydrationWarning
      >
        <ThemeScript />
        <AccessibilityScript />
        <JsonLdScript data={generateJsonLd()} />
        <ColorblindFilters />
        <ConsentProvider>
          <GoogleAnalytics />
          <SentryMonitor />
          <AuthProvider>
            <AccessibilityProvider>
              <GlobalNav />
              <CountdownBanner />
              <SetupBanner />
              <ErrorBoundary level="page">
                <div className="bg-base-200 min-h-0 flex-1 overflow-hidden pb-14">
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
