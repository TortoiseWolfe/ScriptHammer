'use client';

import { useState, useEffect } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export interface SetupBannerProps {
  /** Message to display in the banner */
  message?: string;
  /** Link to setup documentation */
  docsUrl?: string;
  /** Whether to show the banner (defaults to auto-detect based on Supabase config) */
  show?: boolean;
}

const STORAGE_KEY = 'supabase_setup_banner_dismissed';

/**
 * SetupBanner component displays a dismissible alert when Supabase is not configured.
 * Uses session storage to remember dismissal state within a session.
 * Auto-detects Supabase configuration status when show prop is not provided.
 */
export function SetupBanner({
  message = 'Supabase is not configured. Some features may be unavailable.',
  docsUrl = 'https://github.com/TortoiseWolfe/ScriptHammer#supabase-setup',
  show,
}: SetupBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to avoid flash
  const [isClient, setIsClient] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);

  useEffect(() => {
    setIsClient(true);
    // Initialize Supabase client to populate configuration state
    createClient();
    setSupabaseConfigured(isSupabaseConfigured());
    // Check session storage for dismissal state
    const dismissed = sessionStorage.getItem(STORAGE_KEY) === 'true';
    setIsDismissed(dismissed);
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    setIsDismissed(true);
  };

  // Determine if we should show the banner
  // If show prop is provided, use it; otherwise show when Supabase is not configured and not dismissed
  const shouldShow =
    show !== undefined ? show : !supabaseConfigured && !isDismissed;

  // Don't render during SSR or if dismissed
  if (!isClient || !shouldShow) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="alert alert-warning mb-4 shadow-lg"
      data-testid="setup-banner"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <div className="flex-1">
        <span>{message}</span>
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary ml-2"
          >
            View setup guide
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="btn btn-sm btn-ghost"
        aria-label="Dismiss setup banner"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
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
  );
}
