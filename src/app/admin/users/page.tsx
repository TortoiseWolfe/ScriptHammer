'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminUserService } from '@/services/admin/admin-user-service';
import { AdminUserManagement } from '@/components/organisms/AdminUserManagement';
import type {
  AdminUserStats,
  AdminUserRow,
} from '@/services/admin/admin-user-service';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 50;

/** A short reason string from an unknown rejection value. */
function reasonOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * On failure only, say who the DATABASE thinks is calling (#1029).
 *
 * The open contradiction is that AdminGate's bare `is_admin()` returns true —
 * the admin nav renders — while an admin RPC in the same page load answers 403,
 * which since #1031 means its own bare `is_admin()` returned false. Both are the
 * same call from the same client, so one of these is not what it appears.
 *
 * This asks the database directly, at the moment of failure: does a session
 * exist, whose id does it carry, does it match the id React is holding, and what
 * does `is_admin()` say right now. Cheap, runs only when something already went
 * wrong, and answers in one line what has otherwise cost a CI round each time.
 */
async function logAuthDiagnostics(
  contextUserId: string,
  failure: string
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session ?? null;
    const { data: isAdminNow, error: isAdminErr } =
      await supabase.rpc('is_admin');
    // console.error, not the app logger: the E2E readout listens for console
    // messages of type `error`, and routing this elsewhere would hide it from the
    // one place that needs to see it.
    console.error(
      '[admin/users #1029]',
      JSON.stringify({
        failure,
        hasSession: !!session,
        // Whether React's user and the token's user are the same principal.
        sessionUserId: session?.user?.id ?? null,
        contextUserId,
        idsMatch: session?.user?.id === contextUserId,
        expiresAt: session?.expires_at ?? null,
        // The decisive one: what the RPC path says about the caller, taken at the
        // same moment the admin RPC refused.
        isAdminBare: isAdminNow ?? null,
        isAdminError: isAdminErr?.message ?? null,
      })
    );
  } catch {
    // Diagnostics must never replace the original failure.
  }
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hold the initialized service so search refetch doesn't re-initialize.
  const serviceRef = useRef<AdminUserService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminUserService(supabase);

    try {
      await service.initialize(userId);
      serviceRef.current = service;

      // SETTLED, NOT ALL (#1029). These were issued with Promise.all, so either
      // rejecting took out both — the stats and the user list have no dependency
      // on each other, and a failing stats call blanked a perfectly loadable
      // table. It also made the failure unattributable: one console 403 with two
      // candidates behind it, which is what cost several rounds to narrow.
      const [statsResult, listResult] = await Promise.allSettled([
        service.getStats(),
        service.listUsers({ limit: PAGE_SIZE, offset: 0 }),
      ]);

      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (listResult.status === 'fulfilled') {
        setUsers(listResult.value.users);
        setTotal(listResult.value.total);
      }

      const failures = [
        statsResult.status === 'rejected'
          ? `user statistics (${reasonOf(statsResult.reason)})`
          : null,
        listResult.status === 'rejected'
          ? `the user list (${reasonOf(listResult.reason)})`
          : null,
      ].filter(Boolean);

      if (failures.length) {
        // Names WHICH call failed. "Failed to load user data" was true of both
        // and identified neither.
        setError(`Failed to load ${failures.join(' and ')}`);
        await logAuthDiagnostics(userId, failures.join('; '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user data');
      await logAuthDiagnostics(
        userId,
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const service = serviceRef.current;
      if (!service) return;
      try {
        const list = await service.listUsers({
          search: query,
          limit: PAGE_SIZE,
          offset: 0,
        });
        setUsers(list.users);
        setTotal(list.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handlePageChange = useCallback(
    async (page: number) => {
      setCurrentPage(page);
      const service = serviceRef.current;
      if (!service) return;
      try {
        const list = await service.listUsers({
          search: searchQuery || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setUsers(list.users);
        setTotal(list.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Page load failed');
      }
    },
    [searchQuery]
  );

  useEffect(() => {
    if (user?.id) {
      loadData(user.id);
    }
  }, [user?.id, loadData]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div>
      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <AdminUserManagement
        stats={stats}
        users={users}
        total={total}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        isLoading={isLoading}
        testId="admin-users"
      />
    </div>
  );
}
