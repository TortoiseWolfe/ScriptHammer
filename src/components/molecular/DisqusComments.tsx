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
  useEffect(() => {
    if (!isVisible) return;

    // Add a class to body to indicate Disqus is loading
    document.body.classList.add('disqus-loading');

    const style = document.createElement('style');
    style.textContent = `
      /* Fix for Disqus OKLCH color parsing error
         See: https://github.com/disqus/disqus-react/issues/153
         Override OKLCH with RGB fallbacks for Disqus compatibility */

      /* Light theme defaults */
      body.disqus-loading {
        /* These get read by Disqus iframe */
        background-color: rgb(255, 255, 255) !important;
        color: rgb(31, 41, 55) !important;
      }

      #disqus_thread {
        /* Match DaisyUI base styles */
        padding: 1rem;
        border-radius: var(--rounded-box, 1rem);
        background-color: rgb(255, 255, 255) !important;
      }

      #disqus_thread,
      #disqus_thread * {
        /* Use RGB colors that Disqus can parse */
        color: rgb(31, 41, 55) !important;
      }

      #disqus_thread a {
        color: rgb(59, 130, 246) !important;
      }

      /* Dark theme support - check for common dark theme selectors */
      [data-theme="dark"] body.disqus-loading,
      [data-theme="night"] body.disqus-loading,
      [data-theme="dracula"] body.disqus-loading,
      [data-theme="synthwave"] body.disqus-loading,
      [data-theme="halloween"] body.disqus-loading,
      [data-theme="forest"] body.disqus-loading,
      [data-theme="black"] body.disqus-loading,
      [data-theme="luxury"] body.disqus-loading,
      [data-theme="business"] body.disqus-loading,
      [data-theme="coffee"] body.disqus-loading,
      [data-theme="dim"] body.disqus-loading,
      [data-theme="sunset"] body.disqus-loading {
        background-color: rgb(15, 23, 42) !important;
        color: rgb(226, 232, 240) !important;
      }

      [data-theme="dark"] #disqus_thread,
      [data-theme="night"] #disqus_thread,
      [data-theme="dracula"] #disqus_thread,
      [data-theme="synthwave"] #disqus_thread,
      [data-theme="halloween"] #disqus_thread,
      [data-theme="forest"] #disqus_thread,
      [data-theme="black"] #disqus_thread,
      [data-theme="luxury"] #disqus_thread,
      [data-theme="business"] #disqus_thread,
      [data-theme="coffee"] #disqus_thread,
      [data-theme="dim"] #disqus_thread,
      [data-theme="sunset"] #disqus_thread {
        /* Darker background for better contrast */
        background-color: rgb(17, 24, 39) !important;
      }

      [data-theme="dark"] #disqus_thread,
      [data-theme="night"] #disqus_thread,
      [data-theme="dracula"] #disqus_thread,
      [data-theme="synthwave"] #disqus_thread,
      [data-theme="halloween"] #disqus_thread,
      [data-theme="forest"] #disqus_thread,
      [data-theme="black"] #disqus_thread,
      [data-theme="luxury"] #disqus_thread,
      [data-theme="business"] #disqus_thread,
      [data-theme="coffee"] #disqus_thread,
      [data-theme="dim"] #disqus_thread,
      [data-theme="sunset"] #disqus_thread {
        /* Light text for dark themes */
        color: rgb(243, 244, 246) !important;
      }

      [data-theme="dark"] #disqus_thread *,
      [data-theme="night"] #disqus_thread *,
      [data-theme="dracula"] #disqus_thread *,
      [data-theme="synthwave"] #disqus_thread *,
      [data-theme="halloween"] #disqus_thread *,
      [data-theme="forest"] #disqus_thread *,
      [data-theme="black"] #disqus_thread *,
      [data-theme="luxury"] #disqus_thread *,
      [data-theme="business"] #disqus_thread *,
      [data-theme="coffee"] #disqus_thread *,
      [data-theme="dim"] #disqus_thread *,
      [data-theme="sunset"] #disqus_thread * {
        /* Transparent background to inherit, bright text for readability */
        background-color: transparent !important;
        color: rgb(243, 244, 246) !important;
      }

      [data-theme="dark"] #disqus_thread a,
      [data-theme="night"] #disqus_thread a,
      [data-theme="dracula"] #disqus_thread a,
      [data-theme="synthwave"] #disqus_thread a,
      [data-theme="halloween"] #disqus_thread a,
      [data-theme="forest"] #disqus_thread a,
      [data-theme="black"] #disqus_thread a,
      [data-theme="luxury"] #disqus_thread a,
      [data-theme="business"] #disqus_thread a,
      [data-theme="coffee"] #disqus_thread a,
      [data-theme="dim"] #disqus_thread a,
      [data-theme="sunset"] #disqus_thread a {
        /* Brighter blue for better contrast on dark background */
        color: rgb(147, 197, 253) !important;
      }
    `;
    style.setAttribute('data-disqus-override', 'true');
    document.head.appendChild(style);

    return () => {
      // Clean up
      document.body.classList.remove('disqus-loading');
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
