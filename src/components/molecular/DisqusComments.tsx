'use client';

import { useEffect, useRef, useState } from 'react';

interface DisqusCommentsProps {
  slug: string;
  title: string;
  url: string;
}

export default function DisqusComments({
  slug,
  title,
  url,
}: DisqusCommentsProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const shortname = process.env.NEXT_PUBLIC_DISQUS_SHORTNAME;

  useEffect(() => {
    if (!shortname) return;

    // Set up intersection observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    const element = containerRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [shortname]);

  useEffect(() => {
    if (!isVisible || isLoaded || !shortname) return;

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

      script.onload = () => setIsLoaded(true);

      document.body.appendChild(script);
    }
  }, [isVisible, isLoaded, shortname, slug, title, url]);

  if (!shortname) {
    return null;
  }

  return (
    <div ref={containerRef} className="border-base-300 mt-8 border-t pt-6">
      <h2 className="mb-4 text-xl font-semibold">Discussion</h2>
      {!isLoaded && isVisible && (
        <div className="flex items-center justify-center py-8">
          <span className="loading loading-spinner loading-md"></span>
          <span className="ml-2">Loading comments...</span>
        </div>
      )}
      <div id="disqus_thread"></div>
    </div>
  );
}
