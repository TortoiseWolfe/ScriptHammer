# Feature Specification: Row Level Security Foundation

**Feature ID**: 000
**Category**: foundation
**Created**: 2025-12-30
**Status**: Ready for SpecKit
**Input**: User description: "Foundational Row Level Security (RLS) policies establishing security patterns for ALL Supabase tables. Defines core access control before domain-specific features (auth, payments, messaging)."

## Execution Flow (main)

```
1. Parse user description from Input
   -> Feature: Foundational RLS security patterns
2. Extract key concepts from description
   -> Actors: End users, service roles, anonymous users
   -> Actions: SELECT, INSERT, UPDATE, DELETE operations on tables
   -> Data: users, profiles, sessions, audit_logs
   -> Constraints: Zero cross-user data leakage, <10ms policy overhead
3. For each unclear aspect:
   -> All aspects documented below
4. Fill User Scenarios & Testing section
   -> Primary flow: Enable RLS -> Create policies -> Test isolation
5. Generate Functional Requirements
   -> All requirements are testable and defined
6. Identify Key Entities
   -> Core tables, RLS policies, security roles
7. Run Review Checklist
   -> No tech details in functional requirements
   -> All requirements are testable
8. Return: SUCCESS (spec ready for planning)
```

---

## Quick Guidelines

- Focus on WHAT users need and WHY
- Avoid HOW to implement (no tech stack, APIs, code structure)
- Written for business stakeholders, not developers

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a user of ScriptHammer, I need assurance that my personal data (profile, preferences, activity) is completely isolated from other users, so that no one can view, modify, or delete my information without my explicit consent.

### Acceptance Scenarios

#### Scenario 1: User Data Isolation (P0)

1. **Given** I am an authenticated user, **When** I query my profile, **Then** I receive only MY profile data
2. **Given** I am an authenticated user, **When** I attempt to query another user's profile by ID, **Then** I receive no results (empty set)
3. **Given** I am NOT authenticated, **When** I attempt to query any user profiles, **Then** access is denied

#### Scenario 2: Profile Self-Management (P0)

1. **Given** I am authenticated, **When** I update my display name, **Then** the update succeeds for my profile only
2. **Given** I am authenticated, **When** I attempt to update another user's profile, **Then** the update is denied
3. **Given** I am authenticated, **When** I view my profile history, **Then** I see only my own activity

#### Scenario 3: Service Role Operations (P1)

1. **Given** a backend service needs to send emails to multiple users, **When** it uses service role, **Then** it can access required user data
2. **Given** a webhook receives payment confirmation, **When** it needs to update user records, **Then** service role bypass works
3. **Given** an admin needs to investigate an issue, **When** using admin service, **Then** appropriate cross-user access is granted

#### Scenario 4: Audit Trail Protection (P2)

1. **Given** a security audit log entry exists, **When** a user attempts to modify it, **Then** modification is denied
2. **Given** a security audit log entry exists, **When** a user attempts to delete it, **Then** deletion is denied
3. **Given** I am authenticated, **When** I view audit logs, **Then** I see only entries related to my account

#### Scenario 5: Anonymous User Restrictions (P1)

1. **Given** I am NOT authenticated, **When** I attempt any write operation, **Then** access is denied
2. **Given** I am NOT authenticated, **When** I view public content, **Then** only explicitly public data is accessible
3. **Given** I am NOT authenticated, **When** I attempt to enumerate users, **Then** no user data is exposed

### Edge Cases

- What happens when a user's session expires mid-operation?
  -> Operation fails with "session expired" error, no partial data exposed

- How does the system handle orphaned data (user deleted but records remain)?
  -> Orphaned data remains protected, only service role can clean up

- What happens when service role credentials are compromised?
  -> Credential rotation procedures documented, audit logs preserved

- How does the system handle concurrent policy evaluation?
  -> Policies are evaluated atomically per query, no race conditions

- What happens when RLS policies conflict with each other?
  -> Most restrictive policy wins, explicit denials cannot be overridden

---

## Requirements _(mandatory)_

### Functional Requirements

#### Core Table RLS Enablement

- **FR-001**: System MUST enable Row Level Security on the users table
- **FR-002**: System MUST enable Row Level Security on the profiles table
- **FR-003**: System MUST enable Row Level Security on the sessions table
- **FR-004**: System MUST enable Row Level Security on the audit_logs table
- **FR-005**: System MUST enable Row Level Security on ALL new tables by default

#### User Data Isolation Policies

- **FR-006**: System MUST allow authenticated users to SELECT only their own user record
- **FR-007**: System MUST allow authenticated users to SELECT only their own profile
- **FR-008**: System MUST allow authenticated users to UPDATE only their own profile
- **FR-009**: System MUST deny all users from modifying other users' data
- **FR-010**: System MUST return empty results (not errors) when querying unauthorized data

#### Service Role Access

- **FR-011**: System MUST allow service_role to bypass RLS for backend operations
- **FR-012**: System MUST document all service_role usage in audit logs
- **FR-013**: System MUST minimize service_role scope to necessary operations only
- **FR-014**: Service role MUST NOT be exposed to client-side code

#### Audit Trail Protection

- **FR-015**: System MUST allow INSERT to audit_logs only via service_role
- **FR-016**: System MUST deny UPDATE operations on audit_logs for all roles
- **FR-017**: System MUST deny DELETE operations on audit_logs for all roles
- **FR-018**: System MUST allow users to SELECT only their own audit entries

#### Anonymous Access

- **FR-019**: System MUST deny anonymous users write access to all protected tables
- **FR-020**: System MUST allow anonymous SELECT on explicitly public tables only
- **FR-021**: System MUST prevent user enumeration by anonymous users

#### Standard RLS Patterns (Templates)

- **FR-022**: System MUST provide standard owner isolation pattern template
- **FR-023**: System MUST provide service role bypass pattern template
- **FR-024**: System MUST provide soft delete pattern template (no DELETE policy)
- **FR-025**: System MUST provide immutable audit pattern template

### Non-Functional Requirements

#### Security

- **NFR-001**: All protected tables MUST have RLS enabled before production deployment
- **NFR-002**: Zero cross-user data leakage tolerance
- **NFR-003**: Service role access MUST be logged and auditable
- **NFR-004**: RLS policies MUST be tested with every schema migration

#### Performance

- **NFR-005**: RLS policy evaluation MUST add less than 10ms overhead per query
- **NFR-006**: RLS policies MUST use indexed columns for filtering
- **NFR-007**: Complex policies MUST be optimized for query planner efficiency

#### Compliance

- **NFR-008**: RLS policies MUST support GDPR data access requirements
- **NFR-009**: RLS policies MUST support GDPR data deletion (right to be forgotten)
- **NFR-010**: Audit trails MUST be immutable for compliance

#### Testing

- **NFR-011**: RLS policies MUST have integration tests verifying isolation
- **NFR-012**: RLS policies MUST be tested for service role bypass correctness
- **NFR-013**: RLS policy changes MUST require security review

---

## Key Entities _(include if feature involves data)_

### Core Tables

- **users**: Authentication records (id, email, created_at). RLS: owner SELECT, no UPDATE, no DELETE (managed by auth service)

- **profiles**: User profile data (user_id, display_name, avatar_url, bio). RLS: owner SELECT/UPDATE, service INSERT

- **sessions**: Active user sessions. RLS: owner SELECT, system-managed lifecycle

- **audit_logs**: Security event records (user_id, event_type, timestamp, details). RLS: owner SELECT, service INSERT only, no UPDATE/DELETE

### Security Roles

- **authenticated**: Logged-in users with valid JWT. Can access own data only.

- **service_role**: Backend service account. Full access for system operations.

- **anon**: Anonymous/unauthenticated users. Public read-only access where explicitly allowed.

### RLS Policy Types

- **Owner Isolation**: `auth.uid() = user_id` - Users access only their records

- **Service Bypass**: `auth.role() = 'service_role'` - Backend full access

- **Immutable Audit**: INSERT only, no UPDATE/DELETE for any role

- **Public Read**: SELECT allowed for anon, no write operations

---

## Dependencies & Assumptions

### Dependencies

- Database with RLS capability (Supabase/PostgreSQL)
- Authentication service providing valid `auth.uid()` and `auth.role()`
- Audit logging service for policy violation tracking

### Assumptions

- All tables will have a `user_id` foreign key for ownership
- Service role credentials are stored securely (environment variables, not in code)
- Database migrations are version controlled and reviewed

### Known Constraints

- RLS policies MUST be simple enough for query planner optimization
- Cannot use complex subqueries in RLS policies (performance)
- Service role is a single credential (no granular backend roles)

---

## Success Criteria

- **SC-001**: All core tables (users, profiles, sessions, audit_logs) have RLS enabled
- **SC-002**: Zero successful cross-user data access in penetration testing
- **SC-003**: Service role operations complete successfully for documented use cases
- **SC-004**: RLS policy overhead < 10ms (measured via EXPLAIN ANALYZE)
- **SC-005**: All RLS policies have passing integration tests
- **SC-006**: Security review completed before production deployment

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
- [x] Ambiguities marked (none)
- [x] User scenarios defined
- [x] Requirements generated (25 functional, 13 non-functional)
- [x] Entities identified
- [x] Review checklist passed

**Status**: READY FOR `/speckit.specify`
