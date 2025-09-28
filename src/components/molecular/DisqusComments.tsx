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

  // Inject CSS to override OKLCH colors that Disqus can't parse
  // Uses DaisyUI CSS variables converted to HSL (Disqus compatible)
  useEffect(() => {
    if (!isVisible) return;

    const style = document.createElement('style');
    style.textContent = `
      /* Fix for Disqus OKLCH color parsing error
         See: https://github.com/disqus/disqus-react/issues/153
         Uses DaisyUI theme colors in HSL format (Disqus compatible) */

      #disqus_thread {
        /* Use base-100 for background, base-content for text */
        background-color: hsl(var(--b1)) !important;
        color: hsl(var(--bc)) !important;
        padding: 1rem;
        border-radius: var(--rounded-box, 1rem);
      }

      #disqus_thread * {
        /* Inherit theme colors */
        background-color: transparent !important;
        color: inherit !important;
      }

      #disqus_thread a {
        /* Use primary color for links */
        color: hsl(var(--p)) !important;
      }

      #disqus_thread a:hover {
        /* Use primary-focus for hover */
        color: hsl(var(--pf, var(--p))) !important;
      }

      /* Disqus form inputs */
      #disqus_thread input,
      #disqus_thread textarea,
      #disqus_thread select {
        background-color: hsl(var(--b2)) !important;
        color: hsl(var(--bc)) !important;
        border-color: hsl(var(--bc) / 0.2) !important;
      }

      /* Disqus buttons */
      #disqus_thread button {
        background-color: hsl(var(--p)) !important;
        color: hsl(var(--pc)) !important;
      }

      #disqus_thread button:hover {
        background-color: hsl(var(--pf, var(--p))) !important;
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
