'use client';

import { useEffect, useRef, useState } from 'react';

interface DisqusCommentsProps {
  slug: string;
  title: string;
  url: string;
  shortname?: string;
}

export default function DisqusComments({
  slug,
  title,
  url,
  shortname = '',
}: DisqusCommentsProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure component is mounted in browser
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only run in browser after mount
    if (!isMounted || typeof window === 'undefined') {
      return;
    }

    if (!shortname || isLoaded) {
      return;
    }

    // Disqus configuration
    const disqusConfig = function (this: any) {
      this.page.url = url;
      this.page.identifier = slug;
      this.page.title = title;
    };

    // Check if Disqus is already loaded
    if ((window as any).DISQUS) {
      (window as any).DISQUS.reset({
        reload: true,
        config: disqusConfig,
      });
      setIsLoaded(true);
    } else {
      // Load Disqus
      (window as any).disqus_config = disqusConfig;

      const script = document.createElement('script');
      script.src = `https://${shortname}.disqus.com/embed.js`;
      script.setAttribute('data-timestamp', Date.now().toString());
      script.async = true;

      script.onload = () => {
        // Add small delay to ensure DISQUS is fully initialized
        setTimeout(() => {
          if ((window as any).DISQUS) {
            setIsLoaded(true);
          }
        }, 100);
      };

      script.onerror = () => {
        // Silently fail if script doesn't load
      };

      document.body.appendChild(script);
    }
  }, [isMounted, isLoaded, shortname, slug, title, url]);

  // Don't render until mounted in browser
  if (!isMounted || !shortname) {
    return null;
  }

  return (
    <div ref={containerRef} className="border-base-300 mt-8 border-t pt-6">
      <h2 className="mb-4 text-xl font-semibold">Discussion</h2>
      {!isLoaded && (
        <div className="flex items-center justify-center py-8">
          <span className="loading loading-spinner loading-md"></span>
          <span className="ml-2">Loading comments...</span>
        </div>
      )}
      <div id="disqus_thread"></div>
    </div>
  );
}
