# Feature Specification: Admin Dashboard

**Feature ID**: 046
**Category**: admin
**Created**: 2026-02-23
**Status**: Implemented
**Input**: User description: "Master admin dashboard providing read-only oversight of payments, auth audit logs, user management, and messaging metadata. Enforces admin-only access via JWT custom claims in auth.users.raw_app_meta_data. Three-tier architecture: page (auth + state) -> service class (Supabase RPC) -> dumb component (UI only)."

## Execution Flow (main)

```
1. Parse user description from Input
   -> Feature: Admin-only dashboard with 4 data domains
2. Extract key concepts from description
   -> Actors: Admin users (is_admin = true in JWT claims)
   -> Actions: View stats, browse sortable tables, navigate sub-pages
   -> Data: payments, auth audit logs, user profiles, messaging metadata
   -> Constraints: Read-only, no encrypted content exposure, JWT claim gating
3. For each unclear aspect:
   -> All aspects documented below
4. Fill User Scenarios & Testing section
   -> Primary flow: Admin signs in -> Overview stats -> Drill into domain
5. Generate Functional Requirements
   -> All requirements are testable and defined
6. Identify Key Entities
   -> Service classes, RPC functions, RLS policies, components
7. Run Review Checklist
   -> No tech details in functional requirements
   -> All requirements are testable
8. Return: SUCCESS (feature implemented)
```

---

## Quick Guidelines

- Focus on WHAT users need and WHY
- Avoid HOW to implement (no tech stack, APIs, code structure)
- Written for business stakeholders, not developers

---

## Product Requirements

### Problem Statement

Template operators need a centralized view of system activity across payments, authentication, users, and messaging without switching between Supabase dashboards or running raw SQL. The dashboard must be restricted to admin users and must never expose end-to-end encrypted message content.

### Target Users

- Site administrators designated via `is_admin: true` in `auth.users.raw_app_meta_data`
- Non-admin users must never see the admin link or access admin routes

### What It Does

1. **Master Overview** - A single page with stat cards summarizing all 4 data domains at a glance
2. **Payment Detail Page** - Sortable table of recent transactions with provider, amount, status, verification, and customer email
3. **Auth Audit Trail Page** - Filterable table of login events, signup events, and failed authentication attempts
4. **User Management Page** - Table of all non-admin user profiles with username, display name, join date, and welcome message status
5. **Messaging Overview Page** - Aggregate stats on conversations, message volume, and connection status distribution
6. **Conditional Navigation** - Admin link in GlobalNav visible only to admin users, rendered in both mobile drawer and desktop dropdown

### Out of Scope

- Write/edit/delete operations from the dashboard (read-only)
- Decryption or display of encrypted message content or initialization vectors
- User impersonation or session management
- Real-time WebSocket streaming of stats (manual refresh only)
- Export to CSV/PDF
- Role management UI (admin is set via SQL on auth.users)

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a site administrator, I need a consolidated dashboard to monitor system health across payments, authentication, users, and messaging, so that I can identify issues (failed payments, brute-force attempts, stale accounts) without querying the database directly.

### Acceptance Scenarios

#### Scenario 1: Admin Overview (P0)

1. **Given** I am an authenticated admin, **When** I navigate to /admin, **Then** I see stat cards for payments, auth, users, and messaging
2. **Given** I am an authenticated admin, **When** the page loads, **Then** all 4 stat summaries load in parallel
3. **Given** any RPC call fails, **When** the page renders, **Then** I see an error alert with the failure message

#### Scenario 2: Non-Admin Access Denial (P0)

1. **Given** I am an authenticated non-admin user, **When** I navigate to /admin, **Then** I am redirected to the home page
2. **Given** I am not authenticated, **When** I navigate to /admin, **Then** I am redirected to /sign-in
3. **Given** I am a non-admin user, **When** I view the navigation, **Then** no "Admin Dashboard" link is visible

#### Scenario 3: Payment Detail View (P1)

1. **Given** I am on /admin/payments, **When** the page loads, **Then** I see a table of recent transactions
2. **Given** the transaction table is displayed, **When** I click a column header, **Then** the table sorts by that column
3. **Given** a payment result exists, **When** displayed, **Then** I see provider, transaction ID, status, amount, currency, customer email, webhook verification, and timestamp

#### Scenario 4: Auth Audit Trail (P1)

1. **Given** I am on /admin/audit, **When** the page loads, **Then** I see recent auth events with user ID, event type, success status, IP address, and timestamp
2. **Given** the audit table is displayed, **When** I filter by event type, **Then** only matching events are shown

#### Scenario 5: User Management (P1)

1. **Given** I am on /admin/users, **When** the page loads, **Then** I see all non-admin user profiles
2. **Given** a user row is displayed, **When** I inspect it, **Then** I see username, display name, created date, and welcome message sent status

#### Scenario 6: Messaging Overview (P1)

1. **Given** I am on /admin/messaging, **When** the page loads, **Then** I see aggregate messaging statistics
2. **Given** E2E encrypted messages exist, **When** the dashboard loads, **Then** I see message counts and metadata but NEVER encrypted_content or iv columns

#### Scenario 7: RLS Policy Enforcement (P0)

1. **Given** a non-admin JWT, **When** any admin RPC function is called, **Then** it returns an empty JSON object
2. **Given** a non-admin JWT, **When** querying admin-protected tables directly, **Then** only own-user rows are returned (standard user RLS still applies)
3. **Given** an admin JWT, **When** querying via admin RLS policies, **Then** all rows across all users are returned (read-only)

### Edge Cases

- What happens when a user has is_admin in user_profiles but NOT in raw_app_meta_data?
  -> The RPC functions and RLS policies check JWT claims (raw_app_meta_data), not user_profiles. The user_profiles.is_admin column is used only by the client-side AdminAuthService for conditional nav rendering. Both must be true for full admin access.

- What happens if Supabase is paused and RPCs timeout?
  -> Dashboard shows a loading spinner, then an error alert. Stats remain null. No cached data is shown.

- What happens if the admin navigates directly to a sub-page (e.g., /admin/payments)?
  -> The admin layout handles auth checking. If not admin, redirect fires before children render.

- What happens if messages RLS policy allows admin to see encrypted_content?
  -> The admin messaging RLS policy is SELECT on the messages table, but the AdminMessagingService only calls the admin_messaging_stats RPC which returns aggregate counts, never individual message rows.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Admin Authentication & Authorization

- **FR-001**: System MUST verify admin status via JWT custom claim (`app_metadata.is_admin`) before rendering any admin page
- **FR-002**: System MUST redirect non-admin authenticated users to the home page
- **FR-003**: System MUST redirect unauthenticated users to /sign-in
- **FR-004**: System MUST show a loading spinner while admin status is being verified
- **FR-005**: System MUST conditionally render the "Admin Dashboard" link in GlobalNav only for admin users

#### Overview Dashboard

- **FR-006**: System MUST display stat cards for all 4 data domains on the overview page
- **FR-007**: System MUST load all 4 stat summaries in parallel on page mount
- **FR-008**: System MUST display an error alert if any stats fail to load
- **FR-009**: System MUST show loading skeleton/spinner states while stats are fetching

#### Payment Panel

- **FR-010**: System MUST display a sortable table of recent payment transactions
- **FR-011**: System MUST show provider, transaction ID, status, charged amount, currency, customer email, webhook verification status, and creation timestamp for each row
- **FR-012**: System MUST display payment stats (total, successful, failed, pending, revenue, active subscriptions)

#### Auth Audit Trail

- **FR-013**: System MUST display recent auth audit events in a sortable table
- **FR-014**: System MUST show user ID, event type, success status, IP address, and timestamp for each event
- **FR-015**: System MUST support filtering by event type

#### User Management

- **FR-016**: System MUST display all non-admin user profiles in a sortable table
- **FR-017**: System MUST show username, display name, created date, and welcome message sent status for each user
- **FR-018**: System MUST exclude admin users from the user list

#### Messaging Overview

- **FR-019**: System MUST display aggregate messaging statistics (conversation counts, message volume, connection status distribution)
- **FR-020**: System MUST NOT display encrypted_content or iv columns from the messages table
- **FR-021**: System MUST show total conversations, group vs. direct split, messages this week, active connections, blocked connections

#### Database Security

- **FR-022**: All admin RPC functions MUST use SECURITY INVOKER to execute as the calling user
- **FR-023**: All admin RPC functions MUST check `COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false)` and return empty JSON if false
- **FR-024**: Admin RLS policies MUST be read-only (FOR SELECT only)
- **FR-025**: Admin RLS policies MUST use JWT claim check, never subquery user_profiles (avoids infinite recursion)

#### Tab Navigation

- **FR-026**: System MUST provide a tabbed navigation bar with links to Overview, Payments, Audit Trail, Users, and Messaging
- **FR-027**: Navigation MUST be accessible with proper ARIA labels

### Non-Functional Requirements

#### Security

- **NFR-001**: Admin access MUST be enforced at both the database layer (RLS + RPC) and the UI layer (layout redirect)
- **NFR-002**: Zero tolerance for non-admin users viewing cross-user data
- **NFR-003**: Encrypted message content MUST never leave the database via admin queries
- **NFR-004**: Admin RLS policies MUST NOT grant INSERT, UPDATE, or DELETE permissions

#### Performance

- **NFR-005**: Dashboard overview MUST load all 4 stat domains within 3 seconds on cold start
- **NFR-006**: RPC aggregation functions MUST handle up to 100,000 rows per table without timeout
- **NFR-007**: Detail page tables MUST be limited to 50-100 rows per load

#### Accessibility

- **NFR-008**: All tables MUST be sortable via keyboard
- **NFR-009**: All stat cards MUST have semantic headings and ARIA labels
- **NFR-010**: Admin navigation MUST have proper tab focus management
- **NFR-011**: Color contrast MUST meet WCAG AA standards using DaisyUI semantic tokens

#### Testing

- **NFR-012**: All 7 admin components MUST follow the 5-file component pattern
- **NFR-013**: Each component MUST have unit tests, Storybook stories, and accessibility tests
- **NFR-014**: Service classes MUST be independently testable with mocked Supabase clients

---

## Key Entities _(include if feature involves data)_

### Routes

- `/admin` - Overview page with stat cards from all 4 domains
- `/admin/payments` - Payment transaction detail page with sortable table
- `/admin/audit` - Auth audit trail with filterable event log
- `/admin/users` - User profile management table
- `/admin/messaging` - Messaging aggregate statistics

### Service Classes

- **AdminAuthService** - Checks admin status via user_profiles.is_admin (client-side nav gating)
- **AdminPaymentService** - Calls `admin_payment_stats()` RPC and queries `payment_results` table
- **AdminAuditService** - Calls `admin_auth_stats()` RPC and queries `auth_audit_logs` table
- **AdminUserService** - Calls `admin_user_stats()` RPC and queries `user_profiles` table
- **AdminMessagingService** - Calls `admin_messaging_stats()` RPC (aggregate only, no message rows)

### Database Functions (SECURITY INVOKER)

- `admin_payment_stats()` - Returns JSON: total/successful/failed/pending payments, revenue, active subscriptions, failures this week, revenue by provider
- `admin_auth_stats()` - Returns JSON: logins today, failed this week, signups this month, rate-limited users, top failed login accounts
- `admin_user_stats()` - Returns JSON: total users, active this week, pending connections, total connections
- `admin_messaging_stats()` - Returns JSON: total/group/direct conversations, messages this week, active/blocked connections, connection distribution

### RLS Policies (9 admin read-only policies)

All use the pattern: `COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true`

- "Admin can view all profiles" on `user_profiles`
- "Admin can view all audit logs" on `auth_audit_logs`
- "Admin can view all payment intents" on `payment_intents`
- "Admin can view all payment results" on `payment_results`
- "Admin can view all subscriptions" on `subscriptions`
- "Admin can view all rate limits" on `rate_limit_attempts`
- "Admin can view all connections" on `user_connections`
- "Admin can view conversation metadata" on `conversations`
- "Admin can view message metadata" on `messages`

### Components (Atomic Design)

**Organisms** (5 components, 5-file pattern each):

- `AdminDashboardOverview` - Overview page with 4 stat card groups
- `AdminPaymentPanel` - Payment stats and sortable transaction table
- `AdminAuditTrail` - Auth event stats and filterable event table
- `AdminUserManagement` - User stats and sortable user profile table
- `AdminMessagingOverview` - Messaging stats and connection distribution

**Molecular** (2 components, 5-file pattern each):

- `AdminStatCard` - Reusable stat card with label, value, and optional trend indicator
- `AdminDataTable` - Reusable sortable data table with column configuration

### Three-Tier Architecture

```
Page Layer (src/app/admin/*)
  |-- Auth checking (layout.tsx)
  |-- State management (useState, useEffect, useCallback)
  |-- Service instantiation
  v
Service Layer (src/services/admin/*)
  |-- Supabase RPC calls
  |-- Direct table queries (with RLS enforcement)
  |-- Type-safe response mapping
  v
Component Layer (src/components/organisms/Admin*, molecular/Admin*)
  |-- Props-only rendering (dumb components)
  |-- DaisyUI semantic tokens
  |-- Storybook stories with mock data
```

---

## Dependencies & Assumptions

### Dependencies

- **Feature 000** (RLS Implementation) - Foundational RLS patterns that admin policies extend
- **Feature 003** (User Authentication) - JWT auth, AuthContext, sign-in flow
- **Feature 009** (User Messaging System) - Messaging tables (conversations, messages, user_connections)
- **Feature 024** (Payment Integration) - Payment tables (payment_intents, payment_results, subscriptions)

### Assumptions

- Admin users are designated manually via SQL: `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb WHERE id = '<user-id>'`
- The user_profiles.is_admin column is synced separately for client-side nav rendering
- All admin access is read-only; no admin write operations are needed at this time
- The Supabase instance has all referenced tables (auth_audit_logs, rate_limit_attempts, payment_intents, payment_results, subscriptions, user_connections, conversations, messages, user_profiles)

### Known Constraints

- Static export to GitHub Pages means no server-side admin middleware; auth checking happens client-side in layout.tsx
- JWT claims are read-only from the client; admin designation requires direct database access
- RLS policies on user_profiles cannot subquery user_profiles (infinite recursion) so admin check uses JWT claims instead
- Admin messaging view intentionally excludes encrypted_content and iv to respect E2E encryption privacy model

---

## Success Criteria

- **SC-001**: Admin users see stat cards for all 4 domains on the overview page
- **SC-002**: Non-admin users are redirected away from /admin routes and never see the admin nav link
- **SC-003**: All 4 RPC functions return empty JSON for non-admin JWTs
- **SC-004**: All 9 admin RLS policies enforce read-only access gated by JWT is_admin claim
- **SC-005**: The messaging overview displays aggregate counts but never encrypted_content or iv
- **SC-006**: All 7 admin components follow the 5-file pattern with passing tests
- **SC-007**: The admin layout provides tabbed navigation across all 5 sub-pages
- **SC-008**: Dashboard loads all stats in under 3 seconds on cold start

---

## Review & Acceptance Checklist

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities resolved
- [x] User scenarios defined
- [x] Requirements generated (27 functional, 14 non-functional)
- [x] Entities identified
- [x] Review checklist passed

**Status**: IMPLEMENTED
