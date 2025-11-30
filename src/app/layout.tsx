import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ThemeScript from '@/components/ThemeScript';
import { GlobalNav } from '@/components/GlobalNav';
import { Footer } from '@/components/Footer';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import { ColorblindFilters } from '@/components/atomic/ColorblindFilters';
import { ConsentProvider } from '@/contexts/ConsentContext';
import { CookieConsent } from '@/components/privacy/CookieConsent';
import { ConsentModal } from '@/components/privacy/ConsentModal';
import GoogleAnalytics from '@/components/atomic/GoogleAnalytics';
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

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
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

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
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
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://www.googleapis.com https://*.google-analytics.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
      "frame-src 'self' https://www.google.com",
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
        suppressHydrationWarning
      >
        <ThemeScript />
        <JsonLdScript data={generateJsonLd()} />
        <ColorblindFilters />
        <ConsentProvider>
          <GoogleAnalytics />
          <AuthProvider>
            <AccessibilityProvider>
              <GlobalNav />
              <CountdownBanner />
              <ErrorBoundary level="page">
                <main className="min-h-0 flex-1 overflow-hidden">
                  {children}
                </main>
              </ErrorBoundary>
              <Footer />
              <CookieConsent />
              <ConsentModal />
            </AccessibilityProvider>
          </AuthProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
