'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminUserService } from '@/services/admin/admin-user-service';
import { AdminUserManagement } from '@/components/organisms/AdminUserManagement';
import type {
  AdminUserStats,
  AdminUserRow,
} from '@/services/admin/admin-user-service';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminUserService(supabase);

    try {
      await service.initialize(userId);
      const [userStats, userRows] = await Promise.all([
        service.getStats(),
        service.getUsers(),
      ]);
      setStats(userStats);
      setUsers(userRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadData(user.id);
    }
  }, [user?.id, loadData]);

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
        isLoading={isLoading}
        testId="admin-users"
      />
    </div>
  );
}
