'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Reads the `?tab=` URL param and syncs it to parent state via callback.
 * Must be inside a Suspense boundary (Next.js requirement for useSearchParams).
 * Renders nothing — just syncs URL → parent state. Mirrors the messages
 * SearchParamsReader.
 */
export default function SearchParamsReader({
  onParams,
}: {
  onParams: (tab: string | null) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onParams(searchParams?.get('tab') ?? null);
  }, [searchParams, onParams]);

  return null;
}
