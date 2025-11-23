'use client';

import React, { useRef, useCallback } from 'react';
import UserSearch from '@/components/molecular/UserSearch';
import ConnectionManager from '@/components/organisms/ConnectionManager';
import AuthGuard from '@/components/auth/AuthGuard';

export default function ConnectionsPage() {
  const refreshConnectionsRef = useRef<(() => Promise<void>) | null>(null);

  const handleRefreshAvailable = useCallback((refresh: () => Promise<void>) => {
    refreshConnectionsRef.current = refresh;
  }, []);

  const handleRequestSent = useCallback(() => {
    if (refreshConnectionsRef.current) {
      refreshConnectionsRef.current();
    }
  }, []);

  return (
    <AuthGuard requireVerification={true}>
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Connections</h1>

        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-xl font-semibold">Find Users</h2>
            <UserSearch onRequestSent={handleRequestSent} />
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold">Manage Connections</h2>
            <ConnectionManager onRefreshAvailable={handleRefreshAvailable} />
          </section>
        </div>
      </div>
    </AuthGuard>
  );
}
