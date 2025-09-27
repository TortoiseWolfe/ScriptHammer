'use client';

import React from 'react';
import Link from 'next/link';
import { useConsent } from '@/contexts/ConsentContext';

export function PrivacyActions() {
  const { openModal } = useConsent();

  return (
    <nav
      className="mb-8 flex flex-wrap gap-4"
      aria-label="Privacy policy actions"
    >
      <button
        onClick={openModal}
        className="btn btn-primary"
        aria-label="Manage cookie preferences"
      >
        Manage Cookie Preferences
      </button>
      <Link href="/cookies" className="btn btn-outline">
        View Cookie Policy
      </Link>
    </nav>
  );
}
