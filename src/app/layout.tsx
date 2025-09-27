import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ThemeScript from '@/components/ThemeScript';
import { GlobalNav } from '@/components/GlobalNav';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import { ColorblindFilters } from '@/components/atomic/ColorblindFilters';
import { ConsentProvider } from '@/contexts/ConsentContext';
import { CookieConsent } from '@/components/privacy/CookieConsent';
import { ConsentModal } from '@/components/privacy/ConsentModal';
import GoogleAnalytics from '@/components/atomic/GoogleAnalytics';
import ErrorBoundary from '@/components/ErrorBoundary';
import PWAInstall from '@/components/PWAInstall';
import { projectConfig } from '@/config/project.config';
import {
  generateMetadata,
  generateJsonLd,
  JsonLdScript,
} from '@/utils/metadata';

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
    apple: '/apple-icon.png',
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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <JsonLdScript data={generateJsonLd()} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ColorblindFilters />
        <ConsentProvider>
          <GoogleAnalytics />
          <AccessibilityProvider>
            <GlobalNav />
            <ErrorBoundary level="page">{children}</ErrorBoundary>
            <PWAInstall />
            <CookieConsent />
            <ConsentModal />
          </AccessibilityProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
