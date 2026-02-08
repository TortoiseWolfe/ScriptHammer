# Feature: Payment Security RLS Policies

**Feature ID**: 042
**Category**: payments
**Source**: ScriptHammer README (SPEC-058)
**Status**: Ready for SpecKit

## Description

Row Level Security (RLS) policies for payments and subscriptions tables. Ensures users can only access their own payment data and prevents unauthorized access to sensitive financial information.

## User Scenarios

### US-1: Payment Data Access Control (P1)

Users can only view their own payment records.

**Acceptance Criteria**:

1. Given authenticated user, when querying payments, then only own payments returned
2. Given unauthenticated request, when attempted, then access denied
3. Given different user's ID, when queried, then no results returned
4. Given admin user, when querying, then appropriate access granted

### US-2: Subscription Access Control (P1)

Users can only view and manage their own subscriptions.

**Acceptance Criteria**:

1. Given authenticated user, when querying subscriptions, then only own shown
2. Given subscription action, when attempted on other's, then denied
3. Given cancelled subscription, when queried, then still visible to owner
4. Given service role, when needed, then bypass available

### US-3: Payment Creation Security (P2)

Payment records can only be created through authorized flows.

**Acceptance Criteria**:

1. Given payment insert, when from client, then only for authenticated user
2. Given payment insert, when service role, then any user allowed
3. Given foreign user_id, when attempted, then insert denied
4. Given webhook, when processing, then service role used

### US-4: Audit Trail Protection (P2)

Payment audit logs are protected from tampering.

**Acceptance Criteria**:

1. Given audit log, when insert attempted by user, then denied
2. Given audit log, when read by user, then own records only
3. Given audit log, when update attempted, then denied for all
4. Given audit log, when delete attempted, then denied for all

## Requirements

### Functional

**Payments Table RLS**

- FR-001: Enable RLS on payments table
- FR-002: Create SELECT policy for owner access
- FR-003: Create INSERT policy for authenticated users (own records)
- FR-004: Create UPDATE policy for service role only
- FR-005: Deny DELETE for all (soft delete pattern)

**Subscriptions Table RLS**

- FR-006: Enable RLS on subscriptions table
- FR-007: Create SELECT policy for owner access
- FR-008: Create INSERT policy for service role only
- FR-009: Create UPDATE policy for status changes (owner) and full update (service)
- FR-010: Deny DELETE for all

**Payment Methods Table RLS**

- FR-011: Enable RLS on payment_methods table
- FR-012: Create SELECT policy for owner access
- FR-013: Create INSERT policy for owner
- FR-014: Create UPDATE policy for owner
- FR-015: Create DELETE policy for owner (remove saved method)

**Audit Logs RLS**

- FR-016: Enable RLS on payment_audit_logs table
- FR-017: Create SELECT policy for owner (own logs only)
- FR-018: Create INSERT policy for service role only
- FR-019: Deny UPDATE for all
- FR-020: Deny DELETE for all

### Non-Functional

**Security**

- NFR-001: All payment tables have RLS enabled
- NFR-002: No policy allows cross-user access
- NFR-003: Service role access documented and minimized

**Performance**

- NFR-004: Policies use indexed columns
- NFR-005: Policy evaluation < 10ms overhead

**Compliance**

- NFR-006: Policies support GDPR data access
- NFR-007: Audit trail immutable

### Database Migration

```sql
-- Enable RLS on payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own payments
CREATE POLICY "Users can view own payments"
ON payments FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Users can create payments for themselves
CREATE POLICY "Users can create own payments"
ON payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Service role only (for webhook updates)
CREATE POLICY "Service role can update payments"
ON payments FOR UPDATE
USING (auth.role() = 'service_role');

-- DELETE: Denied (use soft delete)
-- No policy = denied

-- Similar policies for subscriptions, payment_methods, audit_logs
```

### Testing Requirements

```
tests/integration/rls/
├── payments-rls.test.ts
├── subscriptions-rls.test.ts
├── payment-methods-rls.test.ts
└── audit-logs-rls.test.ts
```

### Out of Scope

- Admin panel RLS (separate feature)
- Cross-tenant access for platform features
- Billing address RLS (part of profiles)

## Success Criteria

- SC-001: All payment tables have RLS enabled
- SC-002: Users can only access own data
- SC-003: Service role bypass works for webhooks
- SC-004: Audit logs immutable
- SC-005: Performance impact < 10ms per query
- SC-006: Integration tests pass for all policies
