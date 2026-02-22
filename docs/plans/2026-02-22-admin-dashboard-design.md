# Admin Dashboard Design

**Date:** 2026-02-22
**Status:** Approved
**Approach:** Port SpokeToWork three-tier pattern, extend with four ScriptHammer data domains

## Summary

Build an admin dashboard that surfaces payment, auth audit, user, and messaging data across all users. The core challenge is data access: ScriptHammer deploys to GitHub Pages as a static export with no server-side API routes. All queries go through the Supabase client with RLS.

## Decisions

| Decision             | Choice                                    | Rationale                                                 |
| -------------------- | ----------------------------------------- | --------------------------------------------------------- |
| Admin identification | `is_admin` boolean on `user_profiles`     | Flexible for multiple admins, matches SpokeToWork pattern |
| Data aggregation     | Postgres RPC functions (SECURITY INVOKER) | Server-side computation, RLS applies automatically        |
| Architecture         | Port-and-extend from SpokeToWork          | Proven three-tier pattern (page → service → component)    |
| Dashboard scope      | All four domains                          | Payments, auth audit, user management, messaging overview |

## Data Access Layer

### Admin Column

Add `is_admin BOOLEAN DEFAULT FALSE` to `user_profiles` in the monolithic migration. Set `TRUE` for the existing admin UUID (`00000000-0000-0000-0000-000000000001`).

### RLS Policies

Add admin-read SELECT policies on each table. All check:

```sql
EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
```

Tables with admin-read policies:

- `auth_audit_logs` — all columns
- `payment_intents` — all columns
- `payment_results` — all columns
- `subscriptions` — all columns
- `user_profiles` — all columns
- `conversations` — metadata only (id, created_at, is_group, group_name, participant count)
- `messages` — metadata only: `id`, `sender_id`, `conversation_id`, `created_at`, `key_version`, `is_system_message`. Excludes `encrypted_content` and `iv` (E2E encryption respected)
- `user_connections` — all columns
- `rate_limit_attempts` — all columns

### Aggregation Functions (Postgres RPC, SECURITY INVOKER)

- `admin_payment_stats()` — total volume, success/failure rates, revenue by provider, time-series buckets
- `admin_auth_stats()` — login patterns, failed attempts by user, rate limit triggers, signup trends
- `admin_user_stats()` — active accounts, new signups, messaging activity counts, connection stats
- `admin_messaging_stats()` — conversation counts (1-to-1 vs group), message volume (no content), connection status distribution

All functions use `SECURITY INVOKER` so RLS applies to the calling user.

## Route Structure

```
src/app/admin/
├── layout.tsx          # Admin auth guard, sidebar nav, <150 lines
├── page.tsx            # Master overview (stat cards from all 4 domains)
├── payments/page.tsx   # Payment detail view
├── audit/page.tsx      # Auth audit trail view
├── users/page.tsx      # User management view
└── messaging/page.tsx  # Messaging overview view
```

## Service Classes

```
src/services/admin/
├── admin-auth-service.ts       # isAdmin check, admin guard logic
├── admin-payment-service.ts    # Payment stats + drill-down queries via RPC
├── admin-audit-service.ts      # Audit log queries + anomaly detection via RPC
├── admin-user-service.ts       # User listing + activity stats via RPC
└── admin-messaging-service.ts  # Messaging metadata stats via RPC
```

Pattern ported from SpokeToWork's `AdminModerationService`:

- Class-based with explicit `initialize(userId)` call
- Constructor takes Supabase client
- Private `ensureInitialized()` guard on all methods
- Throws errors (caller handles in try/catch)

## Components

### Organism Components (5-file pattern each)

```
src/components/organisms/
├── AdminDashboardOverview/     # Master stat cards grid (all 4 domains)
├── AdminPaymentPanel/          # Transaction table + aggregate stats
├── AdminAuditTrail/            # Event log with filtering + anomaly highlights
├── AdminUserManagement/        # User list with status and activity
└── AdminMessagingOverview/     # Conversation counts, volume, connections
```

### Shared Molecular Components (5-file pattern each)

```
src/components/molecular/
├── AdminStatCard/              # Reusable stat card (value, label, trend)
└── AdminDataTable/             # Reusable sortable/filterable data table
```

All components are dumb — they receive data and callbacks via props. No service calls or auth checks inside components.

## Dashboard Views

### Master Overview (`/admin`)

Responsive grid of stat card groups — one group per domain. Each card shows a key metric with trend indicator. Each group links to its detail page.

- **Payments**: Total volume, success rate %, active subscriptions, failed this week
- **Auth**: Logins today, failed attempts this week, rate-limited users, new signups this month
- **Users**: Total accounts, active this week, pending connections
- **Messaging**: Total conversations, messages this week, group chats, active connections

### Payments (`/admin/payments`)

- Aggregate stats bar: volume, success/failure rates, revenue by provider
- Transaction table: sortable by date, filterable by status
- Provider health indicators

### Audit Trail (`/admin/audit`)

- Event log table: sortable by time, filterable by event_type
- Anomaly highlights: users with most failed logins, rate limit triggers
- 90-day retention indicator

### Users (`/admin/users`)

- User table: username, display_name, created_at, last login, message count
- Status indicators: active/idle/new (badge + text, not color alone)
- Connection stats per user

### Messaging (`/admin/messaging`)

- Conversation counts (1-to-1 vs group)
- Message volume over time (no content exposed)
- Connection status distribution (pending/accepted/blocked/declined)
- Group stats: member counts, key versions

## Security

### Client-Side Guard (admin layout.tsx)

1. `useAuth()` checks authentication → redirect to `/sign-in` if not logged in
2. Query `user_profiles` for `is_admin = true` → redirect to `/` if not admin
3. Render nothing until check completes (no flash of admin content)

### Database-Level Enforcement (defense in depth)

- All admin RLS policies check `is_admin = TRUE` on `user_profiles`
- Non-admin users get empty results even if they navigate to admin routes
- No service role key in client-side code
- RPC functions use SECURITY INVOKER (RLS applies)
- Messages: `encrypted_content` and `iv` excluded from admin SELECT policy

### Testing

- Contract tests: non-admin gets empty results from admin RPC functions
- Contract tests: non-admin cannot read cross-user data
- Unit tests: admin guard redirect behavior
- Storybook: all components across 3 theme surfaces (ThemeShowcase pattern)
- Accessibility: axe-core, keyboard navigation, screen reader labels

## Constraints

- All DaisyUI semantic tokens (zero hardcoded colors)
- 5-file component pattern (enforced by CI)
- All commands through Docker
- Pages under 150 lines
- Status indicators use badge + text (not color alone)
- Static export compatible (no API routes)
- Monolithic migration (additive changes only)

## Source Pattern

Ported from SpokeToWork's admin moderation dashboard:

- `/home/TurtleWolfe/repos/SpokeToWork/src/app/admin/moderation/page.tsx`
- `/home/TurtleWolfe/repos/SpokeToWork/src/lib/companies/admin-moderation-service.ts`
- `/home/TurtleWolfe/repos/SpokeToWork/src/components/organisms/AdminModerationQueue/`

Extended with ScriptHammer-specific data domains from the eval prompt:

- `/home/TurtleWolfe/repos/good_prompt_bad_prompt/prompts/scripthammer-admin-dashboard.md`
