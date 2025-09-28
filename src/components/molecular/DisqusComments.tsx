'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { detectedConfig } from '@/config/project-detected';

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

    // Otherwise, generate the correct production URL
    const baseUrl = detectedConfig.isGitHub
      ? `https://${detectedConfig.projectOwner.toLowerCase()}.github.io/${detectedConfig.projectName}`
      : detectedConfig.projectUrl;

    return `${baseUrl}/blog/${slug}`;
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

  // Don't render if no shortname
  if (!shortname) {
    console.warn('[Disqus Debug] No shortname provided, not rendering');
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
