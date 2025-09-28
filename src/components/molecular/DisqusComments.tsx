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
    disqus_shortname?: string;
    disqus_identifier?: string;
    disqus_url?: string;
    disqus_title?: string;
  }
}

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

  // Generate production URL
  const getProductionUrl = () => {
    // If URL is provided and starts with http, use it
    if (url && url.startsWith('http')) {
      return url;
    }

    // HARDCODED: Your site uses scripthammer.com
    return `https://scripthammer.com/blog/${slug}`;
  };

  const productionUrl = getProductionUrl();

  // Debug logging
  useEffect(() => {
    console.log('[Disqus Debug] Component mounted with:', {
      shortname,
      slug,
      title,
      productionUrl,
      isVisible,
      isLoaded,
      scriptReady,
    });
  }, [shortname, slug, title, productionUrl, isVisible, isLoaded, scriptReady]);

  // Set up intersection observer
  useEffect(() => {
    if (!containerRef.current || !shortname) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log('[Disqus Debug] Component is visible');
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

    console.log('[Disqus Debug] Configuring Disqus...');

    // Set global Disqus configuration
    window.disqus_config = function (this: any) {
      this.page = this.page || {};
      this.page.url = productionUrl;
      this.page.identifier = slug;
      this.page.title = title;

      console.log('[Disqus Debug] Config set:', {
        url: this.page.url,
        identifier: this.page.identifier,
        title: this.page.title,
      });
    };

    // Also set legacy global variables (some Disqus implementations use these)
    window.disqus_shortname = shortname;
    window.disqus_identifier = slug;
    window.disqus_url = productionUrl;
    window.disqus_title = title;

    setIsLoaded(true);
  }, [isVisible, shortname, slug, title, productionUrl, isLoaded]);

  // Initialize or reset Disqus when script is ready
  useEffect(() => {
    if (!scriptReady || !isLoaded || !shortname) return;

    console.log('[Disqus Debug] Script ready, initializing DISQUS...');

    // Check if DISQUS is available
    const checkDisqus = () => {
      if (window.DISQUS) {
        console.log('[Disqus Debug] DISQUS object found, resetting...');
        try {
          window.DISQUS.reset({
            reload: true,
            config: window.disqus_config,
          });
          console.log('[Disqus Debug] DISQUS reset successful');
        } catch (error) {
          console.error('[Disqus Debug] DISQUS reset error:', error);
        }
      } else {
        console.log('[Disqus Debug] DISQUS object not found yet');
      }
    };

    // Try immediately
    checkDisqus();

    // Also try after a delay (in case DISQUS takes time to initialize)
    const timeout = setTimeout(checkDisqus, 1000);

    return () => clearTimeout(timeout);
  }, [scriptReady, isLoaded, shortname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[Disqus Debug] Cleaning up...');

      // Clean up global variables
      delete window.disqus_config;
      delete window.disqus_shortname;
      delete window.disqus_identifier;
      delete window.disqus_url;
      delete window.disqus_title;

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
  // This MUST happen BEFORE Disqus loads to prevent parseColor errors
  useEffect(() => {
    if (!isVisible) return;

    // Add a class to body to indicate Disqus is loading
    document.body.classList.add('disqus-loading');

    const style = document.createElement('style');
    style.textContent = `
      /* CRITICAL FIX for Disqus OKLCH parsing error */
      /* Only apply when Disqus is loading to avoid affecting entire page */
      body.disqus-loading {
        /* Override computed styles with hex colors Disqus can parse */
        background-color: rgb(255, 255, 255) !important;
        color: rgb(15, 23, 42) !important;
      }

      /* Override all CSS custom properties that might contain OKLCH */
      body.disqus-loading * {
        --p: 259.12 83.79% 57.65% !important; /* Primary in HSL */
        --s: 314.27 70.45% 69.02% !important; /* Secondary in HSL */
        --a: 174.14 60.15% 51.18% !important; /* Accent in HSL */
        --n: 213.75 13.79% 15.1% !important; /* Neutral in HSL */
        --b1: 0 0% 100% !important; /* Base 1 in HSL */
        --b2: 0 0% 96.08% !important; /* Base 2 in HSL */
        --b3: 0 0% 92.16% !important; /* Base 3 in HSL */
        --bc: 215 15.69% 17.25% !important; /* Base content in HSL */
        --pc: 259.12 83.79% 91.53% !important; /* Primary content in HSL */
        --sc: 314.27 70.45% 13.8% !important; /* Secondary content in HSL */
        --ac: 174.14 60.15% 10.24% !important; /* Accent content in HSL */
        --nc: 213.75 13.79% 83.02% !important; /* Neutral content in HSL */
      }

      /* Ensure Disqus container uses compatible colors */
      body.disqus-loading #disqus_thread,
      body.disqus-loading #disqus_thread * {
        background-color: rgb(255, 255, 255) !important;
        color: rgb(51, 51, 51) !important;
      }

      body.disqus-loading #disqus_thread a {
        color: rgb(37, 99, 235) !important;
      }

      /* Dark theme overrides */
      body.disqus-loading[data-theme="dark"],
      html[data-theme="dark"] body.disqus-loading {
        background-color: rgb(2, 6, 23) !important;
        color: rgb(248, 250, 252) !important;
      }

      body.disqus-loading[data-theme="dark"] #disqus_thread,
      html[data-theme="dark"] body.disqus-loading #disqus_thread {
        background-color: rgb(15, 23, 41) !important;
        color: rgb(229, 229, 229) !important;
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
            console.log('[Disqus Debug] Script loaded successfully');
            setScriptReady(true);
          }}
          onError={(e) => {
            console.error('[Disqus Debug] Script load error:', e);
          }}
        />
      )}
    </div>
  );
}
