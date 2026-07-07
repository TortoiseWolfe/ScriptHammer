# Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin dashboard that surfaces payment, auth audit, user, and messaging data across all users, solving the static hosting + RLS access problem.

**Architecture:** Port SpokeToWork's three-tier pattern (page -> service class -> dumb component). Admin identity via `is_admin` boolean on `user_profiles`. Data aggregation via Postgres RPC functions with SECURITY INVOKER. All queries through authenticated Supabase client — no service role key in browser.

**Tech Stack:** Next.js 15 App Router, React 19, Supabase (RLS + RPC), DaisyUI semantic tokens, Vitest + RTL + jest-axe, Storybook

**Design Doc:** `docs/plans/2026-02-22-admin-dashboard-design.md`

**Source Pattern:** SpokeToWork `src/app/admin/moderation/page.tsx`, `src/lib/companies/admin-moderation-service.ts`, `src/components/organisms/AdminModerationQueue/`

---

## Task 1: Add `is_admin` Column + Admin RLS Policies

**Files:**

- Modify: `supabase/migrations/20251006_complete_monolithic_setup.sql`

**Step 1: Add `is_admin` to `user_profiles` table definition**

Find the `user_profiles` CREATE TABLE block (around line 163) and add the column:

```sql
-- In the user_profiles CREATE TABLE, after welcome_message_sent:
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
```

**Step 2: Set admin flag on existing admin user insert**

Find the admin user INSERT (around line 1271) and update:

```sql
INSERT INTO user_profiles (id, username, display_name, welcome_message_sent, is_admin)
VALUES ('00000000-0000-0000-0000-000000000001', 'scripthammer', 'ScriptHammer', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;
```

**Step 3: Add admin-read RLS policies**

After the existing RLS policy block (around line 570), add:

```sql
-- ============================================================================
-- ADMIN DASHBOARD RLS POLICIES
-- ============================================================================

-- Admin can read all user profiles
CREATE POLICY "Admin can view all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.is_admin = TRUE)
  );

-- Admin can read all auth audit logs
CREATE POLICY "Admin can view all audit logs" ON auth_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can read all payment intents
CREATE POLICY "Admin can view all payment intents" ON payment_intents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can read all payment results
CREATE POLICY "Admin can view all payment results" ON payment_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can read all subscriptions
CREATE POLICY "Admin can view all subscriptions" ON subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can read all rate limit attempts
CREATE POLICY "Admin can view all rate limits" ON rate_limit_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can read all user connections
CREATE POLICY "Admin can view all connections" ON user_connections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can read conversation metadata (not message content)
CREATE POLICY "Admin can view conversation metadata" ON conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can read message metadata (excludes encrypted_content/iv via RPC function)
CREATE POLICY "Admin can view message metadata" ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
```

**Step 4: Add Postgres RPC functions for aggregation**

Add after the admin RLS policies:

```sql
-- ============================================================================
-- ADMIN DASHBOARD RPC FUNCTIONS (SECURITY INVOKER)
-- ============================================================================

-- Payment statistics
CREATE OR REPLACE FUNCTION admin_payment_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RETURN '{}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_payments', (SELECT COUNT(*) FROM payment_results),
    'successful_payments', (SELECT COUNT(*) FROM payment_results WHERE status = 'succeeded'),
    'failed_payments', (SELECT COUNT(*) FROM payment_results WHERE status = 'failed'),
    'pending_payments', (SELECT COUNT(*) FROM payment_results WHERE status = 'pending'),
    'total_revenue_cents', COALESCE((SELECT SUM(charged_amount) FROM payment_results WHERE status = 'succeeded'), 0),
    'active_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'failed_this_week', (SELECT COUNT(*) FROM payment_results WHERE status = 'failed' AND created_at > NOW() - INTERVAL '7 days'),
    'revenue_by_provider', (
      SELECT COALESCE(json_object_agg(provider, total), '{}'::JSON)
      FROM (SELECT provider, SUM(charged_amount) as total FROM payment_results WHERE status = 'succeeded' GROUP BY provider) p
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Auth audit statistics
CREATE OR REPLACE FUNCTION admin_auth_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RETURN '{}'::JSON;
  END IF;

  SELECT json_build_object(
    'logins_today', (SELECT COUNT(*) FROM auth_audit_logs WHERE event_type = 'sign_in_success' AND created_at > CURRENT_DATE),
    'failed_this_week', (SELECT COUNT(*) FROM auth_audit_logs WHERE event_type = 'sign_in_failed' AND created_at > NOW() - INTERVAL '7 days'),
    'signups_this_month', (SELECT COUNT(*) FROM auth_audit_logs WHERE event_type = 'sign_up' AND created_at > NOW() - INTERVAL '30 days'),
    'rate_limited_users', (SELECT COUNT(DISTINCT identifier) FROM rate_limit_attempts WHERE locked_until IS NOT NULL AND locked_until > NOW()),
    'top_failed_logins', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::JSON)
      FROM (
        SELECT user_id, COUNT(*) as attempts
        FROM auth_audit_logs
        WHERE event_type = 'sign_in_failed' AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY user_id ORDER BY attempts DESC LIMIT 10
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- User statistics
CREATE OR REPLACE FUNCTION admin_user_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RETURN '{}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM user_profiles WHERE is_admin = FALSE),
    'active_this_week', (
      SELECT COUNT(DISTINCT user_id) FROM auth_audit_logs
      WHERE event_type = 'sign_in_success' AND created_at > NOW() - INTERVAL '7 days'
    ),
    'pending_connections', (SELECT COUNT(*) FROM user_connections WHERE status = 'pending'),
    'total_connections', (SELECT COUNT(*) FROM user_connections WHERE status = 'accepted')
  ) INTO result;

  RETURN result;
END;
$$;

-- Messaging statistics (metadata only, no content)
CREATE OR REPLACE FUNCTION admin_messaging_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RETURN '{}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_conversations', (SELECT COUNT(*) FROM conversations),
    'group_conversations', (SELECT COUNT(*) FROM conversations WHERE is_group = TRUE),
    'direct_conversations', (SELECT COUNT(*) FROM conversations WHERE is_group = FALSE OR is_group IS NULL),
    'messages_this_week', (SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '7 days'),
    'active_connections', (SELECT COUNT(*) FROM user_connections WHERE status = 'accepted'),
    'blocked_connections', (SELECT COUNT(*) FROM user_connections WHERE status = 'blocked'),
    'connection_distribution', (
      SELECT COALESCE(json_object_agg(status, cnt), '{}'::JSON)
      FROM (SELECT status, COUNT(*) as cnt FROM user_connections GROUP BY status) c
    )
  ) INTO result;

  RETURN result;
END;
$$;
```

**Step 5: Execute migration via Supabase Management API**

```bash
docker compose exec scripthammer bash -c '
  source .env
  PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed "s|https://||" | sed "s|\.supabase\.co||")
  curl -s -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE; UPDATE user_profiles SET is_admin = TRUE WHERE id = '00000000-0000-0000-0000-000000000001';\"}"
'
```

Then execute the RLS policies and RPC functions similarly. Run each policy and function as a separate API call if needed.

**Step 6: Commit**

```bash
docker compose exec scripthammer git add supabase/migrations/20251006_complete_monolithic_setup.sql
docker compose exec scripthammer git commit -m "feat(admin): add is_admin column, admin RLS policies, and RPC aggregation functions"
```

---

## Task 2: Admin Auth Service

**Files:**

- Create: `src/services/admin/admin-auth-service.ts`
- Create: `src/services/admin/index.ts`

**Step 1: Create the admin auth service**

```typescript
// src/services/admin/admin-auth-service.ts
'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminProfile {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
}

export class AdminAuthService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async checkIsAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error || !data) return false;
    return (data as { is_admin?: boolean }).is_admin === true;
  }
}
```

**Step 2: Create barrel export**

```typescript
// src/services/admin/index.ts
export { AdminAuthService } from './admin-auth-service';
export type { AdminProfile } from './admin-auth-service';
```

**Step 3: Commit**

```bash
docker compose exec scripthammer git add src/services/admin/
docker compose exec scripthammer git commit -m "feat(admin): add AdminAuthService for admin identity checks"
```

---

## Task 3: Admin Layout (Auth Guard)

**Files:**

- Create: `src/app/admin/layout.tsx`

**Step 1: Create the admin layout with auth guard**

Port SpokeToWork's page-level auth check into a shared layout:

```tsx
// src/app/admin/layout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AdminAuthService } from '@/services/admin';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const service = new AdminAuthService(supabase);
      const admin = await service.checkIsAdmin(user.id);
      setIsAdmin(admin);
      if (!admin) router.push('/');
    }

    if (!authLoading) {
      if (!user) {
        router.push('/sign-in');
      } else {
        checkAdmin();
      }
    }
  }, [user, authLoading, router]);

  if (authLoading || isAdmin === null) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto p-6">
      <nav className="tabs tabs-bordered mb-6" aria-label="Admin navigation">
        <a href="/admin" className="tab">
          Overview
        </a>
        <a href="/admin/payments" className="tab">
          Payments
        </a>
        <a href="/admin/audit" className="tab">
          Audit Trail
        </a>
        <a href="/admin/users" className="tab">
          Users
        </a>
        <a href="/admin/messaging" className="tab">
          Messaging
        </a>
      </nav>
      {children}
    </div>
  );
}
```

**Step 2: Commit**

```bash
docker compose exec scripthammer git add src/app/admin/
docker compose exec scripthammer git commit -m "feat(admin): add admin layout with auth guard and tab navigation"
```

---

## Task 4: AdminStatCard (Shared Molecular Component)

Generate via component generator, then implement.

**Files:**

- Create: `src/components/molecular/AdminStatCard/` (5-file pattern)

**Step 1: Generate component scaffold**

```bash
docker compose exec scripthammer pnpm run generate:component
# Name: AdminStatCard
# Level: molecular
```

**Step 2: Implement the component**

```tsx
// src/components/molecular/AdminStatCard/AdminStatCard.tsx
'use client';

import React from 'react';

export interface AdminStatCardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  href?: string;
  className?: string;
  testId?: string;
}

export function AdminStatCard({
  label,
  value,
  description,
  trend,
  href,
  className = '',
  testId = 'admin-stat-card',
}: AdminStatCardProps) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  const trendColor =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-error'
        : 'text-base-content';

  const content = (
    <div className="stat" data-testid={testId}>
      <div className="stat-title">{label}</div>
      <div className={`stat-value ${trendColor}`}>
        {value}
        {trendIcon && <span className="ml-1 text-sm">{trendIcon}</span>}
      </div>
      {description && <div className="stat-desc">{description}</div>}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className={`stats bg-base-100 shadow transition-shadow hover:shadow-md ${className}`}
        aria-label={`${label}: ${value}`}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={`stats bg-base-100 shadow ${className}`}
      aria-label={`${label}: ${value}`}
    >
      {content}
    </div>
  );
}

export default AdminStatCard;
```

**Step 3: Write tests**

```tsx
// src/components/molecular/AdminStatCard/AdminStatCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminStatCard from './AdminStatCard';

describe('AdminStatCard', () => {
  it('renders label and value', () => {
    render(<AdminStatCard label="Total Users" value={42} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <AdminStatCard label="Revenue" value="$1,234" description="This month" />
    );
    expect(screen.getByText('This month')).toBeInTheDocument();
  });

  it('renders as link when href provided', () => {
    render(
      <AdminStatCard label="Payments" value={10} href="/admin/payments" />
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/payments');
  });

  it('has accessible label', () => {
    render(<AdminStatCard label="Active" value={5} />);
    expect(screen.getByLabelText('Active: 5')).toBeInTheDocument();
  });
});
```

**Step 4: Write stories**

```tsx
// src/components/molecular/AdminStatCard/AdminStatCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AdminStatCard from './AdminStatCard';

const meta: Meta<typeof AdminStatCard> = {
  title: 'Atomic Design/Molecular/AdminStatCard',
  component: AdminStatCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof AdminStatCard>;

export const Default: Story = {
  args: { label: 'Total Users', value: 1234 },
};

export const WithTrendUp: Story = {
  args: {
    label: 'Revenue',
    value: '$5,678',
    trend: 'up',
    description: '+12% this week',
  },
};

export const WithTrendDown: Story = {
  args: {
    label: 'Failed Logins',
    value: 23,
    trend: 'down',
    description: '-5% from last week',
  },
};

export const AsLink: Story = {
  args: {
    label: 'Payments',
    value: 42,
    href: '/admin/payments',
    description: 'View details',
  },
};

export const ThemeShowcase: Story = {
  render: () => (
    <div className="space-y-4">
      {(['bg-base-100', 'bg-base-200', 'bg-neutral'] as const).map((bg) => (
        <div key={bg} className={`${bg} rounded-lg p-4`}>
          <AdminStatCard label="Stat" value={99} description={bg} />
        </div>
      ))}
    </div>
  ),
};
```

**Step 5: Write accessibility test**

```tsx
// src/components/molecular/AdminStatCard/AdminStatCard.accessibility.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import AdminStatCard from './AdminStatCard';

expect.extend(toHaveNoViolations);

describe('AdminStatCard Accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<AdminStatCard label="Test" value={42} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations as link', async () => {
    const { container } = render(
      <AdminStatCard label="Test" value={42} href="/admin" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

**Step 6: Run tests**

```bash
docker compose exec scripthammer pnpm test -- --run src/components/molecular/AdminStatCard/
```

**Step 7: Commit**

```bash
docker compose exec scripthammer git add src/components/molecular/AdminStatCard/
docker compose exec scripthammer git commit -m "feat(admin): add AdminStatCard molecular component"
```

---

## Task 5: AdminDataTable (Shared Molecular Component)

**Files:**

- Create: `src/components/molecular/AdminDataTable/` (5-file pattern)

**Step 1: Generate component scaffold**

```bash
docker compose exec scripthammer pnpm run generate:component
# Name: AdminDataTable
# Level: molecular
```

**Step 2: Implement the component**

```tsx
// src/components/molecular/AdminDataTable/AdminDataTable.tsx
'use client';

import React, { useState, useMemo } from 'react';

export interface AdminDataTableColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface AdminDataTableProps<T> {
  columns: AdminDataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  keyField?: string;
  className?: string;
  testId?: string;
}

export function AdminDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data available.',
  keyField = 'id',
  className = '',
  testId = 'admin-data-table',
}: AdminDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
      });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center p-8"
        data-testid={testId}
      >
        <span
          className="loading loading-spinner loading-lg"
          role="status"
          aria-label="Loading data"
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="bg-base-200 rounded-lg p-8 text-center"
        data-testid={testId}
      >
        <p className="text-base-content/70">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`} data-testid={testId}>
      <table className="table" aria-label="Admin data table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={col.sortable ? 'cursor-pointer select-none' : ''}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                aria-sort={
                  sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={String(row[keyField])}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDataTable;
```

**Step 3: Write tests, stories, accessibility tests** (same pattern as Task 4)

**Step 4: Run tests and commit**

```bash
docker compose exec scripthammer pnpm test -- --run src/components/molecular/AdminDataTable/
docker compose exec scripthammer git add src/components/molecular/AdminDataTable/
docker compose exec scripthammer git commit -m "feat(admin): add AdminDataTable molecular component"
```

---

## Task 6: Admin Payment Service

**Files:**

- Create: `src/services/admin/admin-payment-service.ts`
- Modify: `src/services/admin/index.ts`

**Step 1: Create the service**

```typescript
// src/services/admin/admin-payment-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentActivity, PaymentStatsResponse } from '@/types/payment';

export interface AdminPaymentStats {
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  pending_payments: number;
  total_revenue_cents: number;
  active_subscriptions: number;
  failed_this_week: number;
  revenue_by_provider: Record<string, number>;
}

export class AdminPaymentService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminPaymentService not initialized');
  }

  async getStats(): Promise<AdminPaymentStats> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc('admin_payment_stats');
    if (error) throw error;
    return data as AdminPaymentStats;
  }

  async getRecentTransactions(limit = 50): Promise<PaymentActivity[]> {
    this.ensureInitialized();
    const { data, error } = await this.supabase
      .from('payment_results')
      .select(
        `
        id,
        provider,
        transaction_id,
        status,
        charged_amount,
        charged_currency,
        webhook_verified,
        created_at,
        payment_intents(customer_email)
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      provider: r.provider as string,
      transaction_id: r.transaction_id as string,
      status: r.status as string,
      charged_amount: r.charged_amount as number,
      charged_currency: r.charged_currency as string,
      customer_email:
        (r.payment_intents as Record<string, string> | null)?.customer_email ??
        '',
      webhook_verified: r.webhook_verified as boolean,
      created_at: r.created_at as string,
    })) as PaymentActivity[];
  }
}
```

**Step 2: Update barrel export**

```typescript
// Add to src/services/admin/index.ts
export { AdminPaymentService } from './admin-payment-service';
export type { AdminPaymentStats } from './admin-payment-service';
```

**Step 3: Commit**

```bash
docker compose exec scripthammer git add src/services/admin/
docker compose exec scripthammer git commit -m "feat(admin): add AdminPaymentService with RPC stats + transaction queries"
```

---

## Task 7: Admin Audit Service

**Files:**

- Create: `src/services/admin/admin-audit-service.ts`

**Step 1: Create the service**

```typescript
// src/services/admin/admin-audit-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminAuthStats {
  logins_today: number;
  failed_this_week: number;
  signups_this_month: number;
  rate_limited_users: number;
  top_failed_logins: { user_id: string; attempts: number }[];
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  event_type: string;
  success: boolean;
  ip_address: string | null;
  created_at: string;
}

export class AdminAuditService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminAuditService not initialized');
  }

  async getStats(): Promise<AdminAuthStats> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc('admin_auth_stats');
    if (error) throw error;
    return data as AdminAuthStats;
  }

  async getRecentEvents(
    limit = 100,
    eventType?: string
  ): Promise<AuditLogEntry[]> {
    this.ensureInitialized();
    let query = this.supabase
      .from('auth_audit_logs')
      .select('id, user_id, event_type, success, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AuditLogEntry[];
  }
}
```

**Step 2: Update barrel export and commit**

```bash
docker compose exec scripthammer git add src/services/admin/
docker compose exec scripthammer git commit -m "feat(admin): add AdminAuditService with auth stats and event log queries"
```

---

## Task 8: Admin User Service

**Files:**

- Create: `src/services/admin/admin-user-service.ts`

**Step 1: Create the service**

```typescript
// src/services/admin/admin-user-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminUserStats {
  total_users: number;
  active_this_week: number;
  pending_connections: number;
  total_connections: number;
}

export interface AdminUserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  created_at: string;
  welcome_message_sent: boolean;
}

export class AdminUserService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminUserService not initialized');
  }

  async getStats(): Promise<AdminUserStats> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc('admin_user_stats');
    if (error) throw error;
    return data as AdminUserStats;
  }

  async getUsers(limit = 50): Promise<AdminUserRow[]> {
    this.ensureInitialized();
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('id, username, display_name, created_at, welcome_message_sent')
      .eq('is_admin', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as AdminUserRow[];
  }
}
```

**Step 2: Update barrel export and commit**

```bash
docker compose exec scripthammer git add src/services/admin/
docker compose exec scripthammer git commit -m "feat(admin): add AdminUserService with user stats and listing queries"
```

---

## Task 9: Admin Messaging Service

**Files:**

- Create: `src/services/admin/admin-messaging-service.ts`

**Step 1: Create the service**

```typescript
// src/services/admin/admin-messaging-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminMessagingStats {
  total_conversations: number;
  group_conversations: number;
  direct_conversations: number;
  messages_this_week: number;
  active_connections: number;
  blocked_connections: number;
  connection_distribution: Record<string, number>;
}

export class AdminMessagingService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminMessagingService not initialized');
  }

  async getStats(): Promise<AdminMessagingStats> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc('admin_messaging_stats');
    if (error) throw error;
    return data as AdminMessagingStats;
  }
}
```

**Step 2: Update barrel export and commit**

```bash
docker compose exec scripthammer git add src/services/admin/
docker compose exec scripthammer git commit -m "feat(admin): add AdminMessagingService with messaging metadata stats"
```

---

## Task 10: AdminDashboardOverview (Organism) + Admin Overview Page

**Files:**

- Create: `src/components/organisms/AdminDashboardOverview/` (5-file pattern)
- Create: `src/app/admin/page.tsx`

**Step 1: Generate component scaffold**

```bash
docker compose exec scripthammer pnpm run generate:component
# Name: AdminDashboardOverview
# Level: organisms
```

**Step 2: Implement the component**

The component receives stats from all four domains and renders a grid of AdminStatCards grouped by domain. Each group links to its detail page. The component is dumb — no service calls.

```tsx
// src/components/organisms/AdminDashboardOverview/AdminDashboardOverview.tsx
'use client';

import React from 'react';
import AdminStatCard from '@/components/molecular/AdminStatCard';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
import type { AdminAuthStats } from '@/services/admin/admin-audit-service';
import type { AdminUserStats } from '@/services/admin/admin-user-service';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

export interface AdminDashboardOverviewProps {
  paymentStats: AdminPaymentStats | null;
  authStats: AdminAuthStats | null;
  userStats: AdminUserStats | null;
  messagingStats: AdminMessagingStats | null;
  isLoading?: boolean;
  className?: string;
  testId?: string;
}

export function AdminDashboardOverview({
  paymentStats,
  authStats,
  userStats,
  messagingStats,
  isLoading = false,
  className = '',
  testId = 'admin-dashboard-overview',
}: AdminDashboardOverviewProps) {
  if (isLoading) {
    return (
      <div
        className="flex min-h-[30vh] items-center justify-center"
        data-testid={testId}
      >
        <span
          className="loading loading-spinner loading-lg"
          role="status"
          aria-label="Loading dashboard"
        />
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`} data-testid={testId}>
      {/* Payments Section */}
      <section aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="mb-3 text-xl font-bold">
          Payments
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Total Payments"
            value={paymentStats?.total_payments ?? 0}
            href="/admin/payments"
          />
          <AdminStatCard
            label="Success Rate"
            value={
              paymentStats
                ? `${paymentStats.total_payments > 0 ? Math.round((paymentStats.successful_payments / paymentStats.total_payments) * 100) : 0}%`
                : '0%'
            }
          />
          <AdminStatCard
            label="Active Subscriptions"
            value={paymentStats?.active_subscriptions ?? 0}
          />
          <AdminStatCard
            label="Failed This Week"
            value={paymentStats?.failed_this_week ?? 0}
            trend={paymentStats?.failed_this_week ? 'down' : 'neutral'}
          />
        </div>
      </section>

      {/* Auth Section */}
      <section aria-labelledby="auth-heading">
        <h2 id="auth-heading" className="mb-3 text-xl font-bold">
          Authentication
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Logins Today"
            value={authStats?.logins_today ?? 0}
            href="/admin/audit"
          />
          <AdminStatCard
            label="Failed This Week"
            value={authStats?.failed_this_week ?? 0}
            trend={authStats?.failed_this_week ? 'down' : 'neutral'}
          />
          <AdminStatCard
            label="Rate Limited"
            value={authStats?.rate_limited_users ?? 0}
          />
          <AdminStatCard
            label="New Signups (30d)"
            value={authStats?.signups_this_month ?? 0}
            trend="up"
          />
        </div>
      </section>

      {/* Users Section */}
      <section aria-labelledby="users-heading">
        <h2 id="users-heading" className="mb-3 text-xl font-bold">
          Users
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Total Users"
            value={userStats?.total_users ?? 0}
            href="/admin/users"
          />
          <AdminStatCard
            label="Active This Week"
            value={userStats?.active_this_week ?? 0}
          />
          <AdminStatCard
            label="Pending Connections"
            value={userStats?.pending_connections ?? 0}
          />
          <AdminStatCard
            label="Total Connections"
            value={userStats?.total_connections ?? 0}
          />
        </div>
      </section>

      {/* Messaging Section */}
      <section aria-labelledby="messaging-heading">
        <h2 id="messaging-heading" className="mb-3 text-xl font-bold">
          Messaging
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Conversations"
            value={messagingStats?.total_conversations ?? 0}
            href="/admin/messaging"
          />
          <AdminStatCard
            label="Messages This Week"
            value={messagingStats?.messages_this_week ?? 0}
          />
          <AdminStatCard
            label="Group Chats"
            value={messagingStats?.group_conversations ?? 0}
          />
          <AdminStatCard
            label="Active Connections"
            value={messagingStats?.active_connections ?? 0}
          />
        </div>
      </section>
    </div>
  );
}

export default AdminDashboardOverview;
```

**Step 3: Write tests, stories, accessibility tests** (same pattern as Task 4)

**Step 4: Create the admin overview page**

```tsx
// src/app/admin/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import AdminDashboardOverview from '@/components/organisms/AdminDashboardOverview';
import { AdminPaymentService } from '@/services/admin/admin-payment-service';
import { AdminAuditService } from '@/services/admin/admin-audit-service';
import { AdminUserService } from '@/services/admin/admin-user-service';
import { AdminMessagingService } from '@/services/admin/admin-messaging-service';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
import type { AdminAuthStats } from '@/services/admin/admin-audit-service';
import type { AdminUserStats } from '@/services/admin/admin-user-service';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentStats, setPaymentStats] = useState<AdminPaymentStats | null>(
    null
  );
  const [authStats, setAuthStats] = useState<AdminAuthStats | null>(null);
  const [userStats, setUserStats] = useState<AdminUserStats | null>(null);
  const [messagingStats, setMessagingStats] =
    useState<AdminMessagingStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;
      try {
        const [paymentSvc, auditSvc, userSvc, msgSvc] = [
          new AdminPaymentService(supabase),
          new AdminAuditService(supabase),
          new AdminUserService(supabase),
          new AdminMessagingService(supabase),
        ];
        await Promise.all([
          paymentSvc.initialize(user.id),
          auditSvc.initialize(user.id),
          userSvc.initialize(user.id),
          msgSvc.initialize(user.id),
        ]);
        const [p, a, u, m] = await Promise.all([
          paymentSvc.getStats(),
          auditSvc.getStats(),
          userSvc.getStats(),
          msgSvc.getStats(),
        ]);
        setPaymentStats(p);
        setAuthStats(a);
        setUserStats(u);
        setMessagingStats(m);
      } catch (err) {
        console.error('Failed to load admin stats:', err);
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, [user]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-base-content/70 mt-1">
          System overview across all users
        </p>
      </header>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <AdminDashboardOverview
        paymentStats={paymentStats}
        authStats={authStats}
        userStats={userStats}
        messagingStats={messagingStats}
        isLoading={isLoading}
      />
    </>
  );
}
```

**Step 5: Run tests and commit**

```bash
docker compose exec scripthammer pnpm test -- --run src/components/organisms/AdminDashboardOverview/
docker compose exec scripthammer git add src/components/organisms/AdminDashboardOverview/ src/app/admin/page.tsx
docker compose exec scripthammer git commit -m "feat(admin): add overview page with 4-domain stat card grid"
```

---

## Task 11: AdminPaymentPanel (Organism) + Payments Page

**Files:**

- Create: `src/components/organisms/AdminPaymentPanel/` (5-file pattern)
- Create: `src/app/admin/payments/page.tsx`

Same pattern as Task 10. The component renders:

- Stats bar (from `AdminPaymentService.getStats()`)
- Transaction table using `AdminDataTable` (from `AdminPaymentService.getRecentTransactions()`)
- Status badges: `badge-success` for succeeded, `badge-error` for failed, `badge-warning` for pending
- Provider health indicators

Page stays under 150 lines by delegating to component.

**Commit message:** `feat(admin): add payments detail page with transaction table`

---

## Task 12: AdminAuditTrail (Organism) + Audit Page

**Files:**

- Create: `src/components/organisms/AdminAuditTrail/` (5-file pattern)
- Create: `src/app/admin/audit/page.tsx`

Same pattern. The component renders:

- Stats bar from `AdminAuditService.getStats()`
- Event log table using `AdminDataTable` with event_type filter dropdown
- Anomaly section: top failed logins from `authStats.top_failed_logins`
- 90-day retention notice

**Commit message:** `feat(admin): add audit trail page with event log and anomaly detection`

---

## Task 13: AdminUserManagement (Organism) + Users Page

**Files:**

- Create: `src/components/organisms/AdminUserManagement/` (5-file pattern)
- Create: `src/app/admin/users/page.tsx`

Same pattern. The component renders:

- Stats bar from `AdminUserService.getStats()`
- User table using `AdminDataTable` (username, display_name, created_at, welcome_message_sent)
- Status badges: `badge-success` active, `badge-info` new, `badge-ghost` idle

**Commit message:** `feat(admin): add user management page with user listing`

---

## Task 14: AdminMessagingOverview (Organism) + Messaging Page

**Files:**

- Create: `src/components/organisms/AdminMessagingOverview/` (5-file pattern)
- Create: `src/app/admin/messaging/page.tsx`

Same pattern. The component renders:

- Stats from `AdminMessagingService.getStats()`
- Connection distribution breakdown (accepted/pending/blocked/declined)
- Conversation split (direct vs group)
- Note: "Message content is end-to-end encrypted and not accessible to admins."

**Commit message:** `feat(admin): add messaging overview page with connection stats`

---

## Task 15: Contract Tests (Security Verification)

**Files:**

- Create: `tests/contract/admin/admin-access.contract.test.ts`

Test that non-admin users get empty results from admin RPC functions and cannot read cross-user data.

```typescript
// tests/contract/admin/admin-access.contract.test.ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Admin Access Contract Tests', () => {
  // Sign in as non-admin test user
  it('non-admin gets empty result from admin_payment_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_payment_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_auth_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_auth_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_user_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_user_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_messaging_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_messaging_stats');
    expect(data).toEqual({});
  });
});
```

**Commit message:** `test(admin): add contract tests verifying non-admin cannot access admin RPC functions`

---

## Task 16: Final Integration Verification

**Step 1: Run full test suite**

```bash
docker compose exec scripthammer pnpm run test:suite
```

**Step 2: Run type-check**

```bash
docker compose exec scripthammer pnpm run type-check
```

**Step 3: Run lint**

```bash
docker compose exec scripthammer pnpm run lint
```

**Step 4: Visual verification with Playwright**

Screenshot all admin pages across desktop and mobile.

**Step 5: Theme verification**

Check admin pages against 3 themes (scripthammer-dark, scripthammer-light, dracula).

**Step 6: Update documentation**

Update README.md session continuation prompt and design doc status.

**Step 7: Final commit**

```bash
docker compose exec scripthammer git commit -m "docs: mark admin dashboard feature complete"
```
