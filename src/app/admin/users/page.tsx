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

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
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
      const [userStats, list] = await Promise.all([
        service.getStats(),
        service.listUsers(),
      ]);
      setStats(userStats);
      setUsers(list.users);
      setTotal(list.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const service = serviceRef.current;
      if (!service) return;
      try {
        const list = await service.listUsers({ search: query });
        setUsers(list.users);
        setTotal(list.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold">User Management</h1>
      </div>

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
        isLoading={isLoading}
        testId="admin-users"
      />
    </div>
  );
}
