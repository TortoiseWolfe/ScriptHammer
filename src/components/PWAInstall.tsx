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

      window.addEventListener('load', () => {
        // Use dynamic basePath from project config
        const swPath = projectConfig.swPath;

        logger.debug('Registering Service Worker', { path: swPath });

        // Add timestamp to force update
        const swUrl = `${swPath}?v=${Date.now()}`;

        navigator.serviceWorker.register(swUrl).then(
          (registration) => {
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
      });
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

  // Removed unused handleHideForever - functionality handled by handleDismiss

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
      // Remove the query parameter to avoid constant resets
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Show if: debug mode is on, OR install button should show and not installed
  if (!isDebugMode && (!showInstallButton || isInstalled)) return null;

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
          className="btn btn-circle btn-info btn-sm shadow-lg transition-all hover:scale-110"
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
          className="btn btn-info btn-xs"
          title="Progressive Web App (PWA) - Install this website as an app that works offline, loads instantly, and doesn't require an app store"
        >
          Install
        </button>
        <button
          onClick={handleMinimize}
          className="btn btn-ghost btn-circle btn-xs"
          aria-label="Minimize"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="h-3 w-3 stroke-current"
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
