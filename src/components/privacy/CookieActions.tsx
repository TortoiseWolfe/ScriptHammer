'use client';

import React from 'react';
import Link from 'next/link';
import { useConsent } from '@/contexts/ConsentContext';

export function CookieActions() {
  const { openModal } = useConsent();

  return (
    <nav
      className="mb-8 flex flex-wrap gap-4"
      aria-label="Cookie policy actions"
    >
      <button
        onClick={openModal}
        className="btn btn-primary"
        aria-label="Manage cookie preferences"
      >
        Manage Cookie Preferences
      </button>
      <Link href="/privacy" className="btn btn-outline">
        View Privacy Policy
      </Link>
      <Link href="/privacy-controls" className="btn btn-outline">
        Privacy Controls
      </Link>
    </nav>
  );
}
