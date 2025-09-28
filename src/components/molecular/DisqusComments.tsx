'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

interface DisqusCommentsProps {
  slug: string;
  title: string;
  url: string;
  shortname?: string;
}

declare global {
  interface Window {
    DISQUS?: any;
    disqus_config?: any;
  }
}

/**
 * Disqus Comments Component
 *
 * IMPORTANT FIXES:
 * 1. URL is hardcoded to scripthammer.com because environment variables
 *    are not available during GitHub Actions static build
 * 2. CSS overrides are applied to prevent OKLCH color parsing errors
 *    (Disqus embed.js cannot parse modern OKLCH color format)
 * 3. No dynamic imports - they exclude components from static builds
 */
export default function DisqusComments({
  slug,
  title,
  url,
  shortname = '',
}: DisqusCommentsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate production URL - hardcoded for GitHub Actions compatibility
  const productionUrl = url?.startsWith('http')
    ? url
    : `https://scripthammer.com/blog/${slug}`;

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current || !shortname) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observerRef.current?.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [shortname]);

  // Configure Disqus when visible
  useEffect(() => {
    if (!isVisible || !shortname || isLoaded) return;

    // Set global Disqus configuration
    window.disqus_config = function (this: any) {
      this.page = this.page || {};
      this.page.url = productionUrl;
      this.page.identifier = slug;
      this.page.title = title;
    };

    setIsLoaded(true);
  }, [isVisible, shortname, slug, title, productionUrl, isLoaded]);

  // Initialize or reset Disqus when script is ready
  useEffect(() => {
    if (!scriptReady || !isLoaded || !shortname) return;

    // Check if DISQUS is available and reset it
    const initializeDisqus = () => {
      if (window.DISQUS) {
        try {
          window.DISQUS.reset({
            reload: true,
            config: window.disqus_config,
          });
        } catch (error) {
          // Silently handle errors
        }
      }
    };

    // Try immediately and after a delay
    initializeDisqus();
    const timeout = setTimeout(initializeDisqus, 1000);

    return () => clearTimeout(timeout);
  }, [scriptReady, isLoaded, shortname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up global variables
      delete window.disqus_config;

      // Remove Disqus script
      const script = document.querySelector(
        `script[src*="${shortname}.disqus.com/embed.js"]`
      );
      if (script) {
        script.remove();
      }

      // Reset DISQUS if it exists
      if (window.DISQUS) {
        try {
          window.DISQUS.reset({});
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, [shortname]);

  // Inject minimal CSS to fix OKLCH parsing without conflicts
  useEffect(() => {
    if (!isVisible) return;

    // Get computed styles to determine if we're in a dark theme
    const isDarkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      return (
        theme &&
        [
          'dark',
          'night',
          'dracula',
          'synthwave',
          'halloween',
          'forest',
          'black',
          'luxury',
          'business',
          'coffee',
          'dim',
          'sunset',
        ].includes(theme)
      );
    };

    const dark = isDarkTheme();

    const style = document.createElement('style');
    style.textContent = `
      /* Minimal override for Disqus OKLCH compatibility
         Only set what's absolutely necessary to prevent conflicts */

      :root {
        /* Override CSS variables with RGB fallbacks for Disqus */
        --disqus-bg: ${dark ? 'rgb(17, 24, 39)' : 'rgb(255, 255, 255)'};
        --disqus-text: ${dark ? 'rgb(243, 244, 246)' : 'rgb(31, 41, 55)'};
        --disqus-link: ${dark ? 'rgb(147, 197, 253)' : 'rgb(59, 130, 246)'};
      }

      #disqus_thread {
        /* Use the fallback variables */
        background-color: var(--disqus-bg) !important;
        color: var(--disqus-text) !important;
        padding: 1rem;
        border-radius: var(--rounded-box, 1rem);
      }

      #disqus_thread * {
        /* Let children inherit, don't force colors */
        background-color: transparent !important;
        color: inherit !important;
      }

      #disqus_thread a {
        color: var(--disqus-link) !important;
      }

      #disqus_thread a:hover {
        opacity: 0.8;
      }
    `;
    style.setAttribute('data-disqus-override', 'true');
    document.head.appendChild(style);

    return () => {
      const styleToRemove = document.querySelector(
        'style[data-disqus-override="true"]'
      );
      if (styleToRemove) {
        document.head.removeChild(styleToRemove);
      }
    };
  }, [isVisible]);

  // Don't render if no shortname
  if (!shortname) {
    return null;
  }

  return (
    <div ref={containerRef} className="border-base-300 mt-8 border-t pt-6">
      <h2 className="mb-4 text-xl font-semibold">Discussion</h2>

      {/* Loading state */}
      {isVisible && !scriptReady && (
        <div className="flex items-center justify-center py-8">
          <span className="loading loading-spinner loading-md"></span>
          <span className="ml-2">Loading comments...</span>
        </div>
      )}

      {/* Disqus thread container */}
      <div id="disqus_thread" />

      {/* Load Disqus script when visible */}
      {isVisible && isLoaded && (
        <Script
          id={`disqus-script-${shortname}`}
          src={`https://${shortname}.disqus.com/embed.js`}
          strategy="afterInteractive"
          onLoad={() => {
            setScriptReady(true);
          }}
          onError={() => {
            // Silently handle script load errors
          }}
        />
      )}
    </div>
  );
}
