'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Reads URL search params and syncs to parent state via callback.
 * Must be inside a Suspense boundary (Next.js requirement for useSearchParams).
 * Renders nothing — just syncs URL → parent state.
 */
export default function SearchParamsReader({
  onParams,
}: {
  onParams: (conversationId: string | null, tab: string | null) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onParams(
      searchParams?.get('conversation') ?? null,
      searchParams?.get('tab') ?? null
    );
  }, [searchParams, onParams]);

  return null;
}
