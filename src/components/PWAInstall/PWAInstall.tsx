'use client';

import { useEffect, useState } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { projectConfig } from '@/config/project.config';
import { createLogger } from '@/lib/logger';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const logger = createLogger('components:pwa');

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  // State, not a one-shot read (#1012). The old code consulted
  // `pwa-install-dismissed` inside a mount-only effect and called
  // setShowInstallButton(false), which the beforeinstallprompt handler then set
  // straight back to true whenever the browser fired — on its own schedule,
  // usually after mount. Holding it as state and gating the RENDER means a later
  // prompt cannot resurrect a pill the visitor has already dismissed.
  const [isDismissed, setIsDismissed] = useState(false);
  const { trackPWAEvent } = useAnalytics();

  // Check debug mode immediately
  const [isDebugMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('pwa-debug') === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Register service worker (enabled in development for testing)
    if ('serviceWorker' in navigator) {
      // Skip in test environments
      if (process.env.NODE_ENV === 'test') return;

      const registerSW = () => {
        // Use dynamic basePath from project config
        const swPath = projectConfig.swPath;

        logger.debug('Registering Service Worker', { path: swPath });

        // Add timestamp to force update
        const swUrl = `${swPath}?v=${Date.now()}`;

        navigator.serviceWorker.register(swUrl).then(
          (registration) => {
            // Defensive: register() is spec'd to resolve with a
            // ServiceWorkerRegistration, but in some hosting setups
            // (wrong MIME type, partial response, certain CSP rules) the
            // promise resolves with `undefined` instead of rejecting. The
            // optional-chained logger fields above always survived; the
            // unchecked `registration.update()` calls below were exploding
            // on every page load and surfacing as a pageerror noise. See
            // the diagnostic round on PR #65 for the full trace.
            if (!registration) {
              logger.warn(
                'Service Worker register() resolved with undefined — likely sw.js MIME or CSP issue'
              );
              return;
            }

            logger.info('Service Worker registered', {
              scope: registration.scope,
              state: registration.active?.state || 'installing',
            });

            // Force update check
            registration.update().catch((err) => {
              logger.debug('SW update failed', { error: err });
            });

            // Check for updates periodically
            setInterval(() => {
              registration.update().catch((err) => {
                logger.debug('SW update check failed', { error: err });
              });
            }, 60000); // Check every minute
          },
          (error) => {
            logger.error('Service Worker registration failed', { error });
          }
        );
      };

      // By the time this effect runs, `load` has almost certainly already
      // fired (React mounts after DOMContentLoaded). Register immediately
      // if so; otherwise defer until load.
      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW, { once: true });
      }
    } else {
      logger.debug('Service Worker not supported in this browser');
    }

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      logger.info('Install prompt captured');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);

      // Track that the install prompt is available
      trackPWAEvent('install_prompt_shown');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if the app was successfully installed
    window.addEventListener('appinstalled', () => {
      logger.info('PWA installed');
      setIsInstalled(true);
      setShowInstallButton(false);
      setDeferredPrompt(null);

      // Track successful installation
      trackPWAEvent('installed');
    });

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
    };
  }, [trackPWAEvent]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Track install button click
    trackPWAEvent('install_button_clicked');

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user choice
    const { outcome } = await deferredPrompt.userChoice;
    logger.info('User install choice', { outcome });

    // Track the outcome
    trackPWAEvent(
      outcome === 'accepted' ? 'install_accepted' : 'install_dismissed'
    );

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    // Store minimized state in localStorage
    localStorage.setItem('pwa-install-minimized', 'true');

    // Track minimization
    trackPWAEvent('install_prompt_minimized');
  };

  const handleExpand = () => {
    setIsMinimized(false);
    localStorage.removeItem('pwa-install-minimized');

    // Track expansion
    trackPWAEvent('install_prompt_expanded');
  };

  /**
   * Dismiss for good (#1012).
   *
   * Nothing used to write `pwa-install-dismissed` — the component only ever read
   * and removed it, and the close button minimised instead. So the prompt could
   * be shrunk to a circle that then sat on every page forever, but never told to
   * go away. `?pwa-debug=true` and `?pwa-reset=true` still clear it.
   */
  const handleDismiss = () => {
    setIsDismissed(true);
    setShowInstallButton(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
    trackPWAEvent('install_prompt_dismissed');
  };

  // Check localStorage for previous state
  useEffect(() => {
    // Check for debug mode
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('pwa-debug') === 'true';

    if (debugMode) {
      logger.debug('Debug mode enabled - forcing install prompt to show');
      setShowInstallButton(true);
      setIsMinimized(false);
      // Clear dismissal in debug mode
      localStorage.removeItem('pwa-install-dismissed');
      localStorage.removeItem('pwa-install-minimized');
    } else if (localStorage.getItem('pwa-install-dismissed') === 'true') {
      setIsDismissed(true);
      setShowInstallButton(false);
    } else if (localStorage.getItem('pwa-install-minimized') === 'true') {
      setIsMinimized(true);
    }
  }, []);

  // Check for reset request
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pwa-reset') === 'true') {
      logger.debug('Resetting install prompt dismissal');
      localStorage.removeItem('pwa-install-dismissed');
      setIsDismissed(false);
      // Remove the query parameter to avoid constant resets
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Show if: debug mode is on, OR install button should show and not installed.
  // isDismissed is checked HERE rather than only at mount, so it survives a
  // beforeinstallprompt that arrives later (#1012).
  if (!isDebugMode && (isDismissed || !showInstallButton || isInstalled))
    return null;

  // Log debug info
  if (isDebugMode) {
    logger.debug('Component rendering in debug mode', {
      showInstallButton,
      isInstalled,
      hasDeferredPrompt: !!deferredPrompt,
    });
  }

  // Minimized CTA button
  if (isMinimized && !isInstalled) {
    return (
      <div className="fixed top-20 right-4 z-50">
        <button
          onClick={handleExpand}
          className="btn btn-circle btn-info min-h-11 min-w-11 shadow-lg transition-all hover:scale-110"
          aria-label="Install Progressive Web App"
          title="Progressive Web App (PWA) - An app that works offline, can be installed like a native app, and loads instantly"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="h-6 w-6 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>
      </div>
    );
  }

  // Compact pill UI
  return (
    <div className="animate-fade-in fixed top-20 right-4 z-50">
      <div className="bg-base-100/95 border-base-300 flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="stroke-info h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        <span
          className="hidden text-sm font-medium sm:inline"
          title="Progressive Web App"
        >
          Install as PWA
        </span>
        <button
          onClick={handleInstallClick}
          className="btn btn-info min-h-11"
          title="Progressive Web App (PWA) - Install this website as an app that works offline, loads instantly, and doesn't require an app store"
        >
          Install
        </button>
        {/* Minimise and dismiss are SEPARATE controls (#1012). A single × that
            minimised was the whole problem: it reads as "close", and what it
            actually did was shrink the prompt to a circle that then followed the
            visitor across every page with no way to be rid of it. */}
        <button
          onClick={handleMinimize}
          className="btn btn-ghost btn-circle min-h-11 min-w-11"
          aria-label="Minimize"
          title="Collapse this to a small button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="h-4 w-4 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20 12H4"
            />
          </svg>
        </button>
        <button
          onClick={handleDismiss}
          className="btn btn-ghost btn-circle min-h-11 min-w-11"
          aria-label="Don't show this again"
          title="Don't show this again"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="h-4 w-4 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
