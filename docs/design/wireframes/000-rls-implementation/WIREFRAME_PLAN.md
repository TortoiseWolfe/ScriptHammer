# Wireframe Plan: 000-rls-implementation

## Status: PENDING FRESH GENERATION

Delete all existing SVGs and regenerate from scratch following this plan.

---

## Wireframe Structure (3 SVGs)

| File | Canvas | Content |
|------|--------|---------|
| `01-rls-architecture-overview.svg` | 1600×1000 | Security roles, policy flow, 4 tables, USER STORIES, legend |
| `02-rls-policy-patterns.svg` | 1600×800 | 4 compact SQL patterns, requirements key (NO user stories) |
| `03-rls-role-matrix.svg` | 1400×800 | Role Access Matrix, requirements key (NO user stories) |

---

## Content Details

### 01 - Architecture Overview (1600×1000)

- Security Roles: authenticated, service_role, anon
- Policy evaluation flow diagram
- 4 Protected tables: users, profiles, sessions, audit_logs (with compact badges)
- USER STORIES section (US-001 to US-005 with priorities)
- RLS Legend + Requirements Key

### 02 - Policy Patterns (1600×800)

- Pattern 1: Owner Isolation (FR-022)
- Pattern 2: Service Role Bypass (FR-023)
- Pattern 3: Soft Delete (FR-024)
- Pattern 4: Immutable Audit (FR-025)
- Each with compact SQL example
- Requirements Key at bottom

### 03 - Role Matrix (1400×800)

- Full Role Access Matrix (Table × Operation × Role)
- Tables: users, profiles, sessions, audit_logs
- Operations: SELECT, INSERT, UPDATE, DELETE
- Roles: authenticated, service_role, anon
- Requirements Key at bottom

---

## Badge Consistency Rules

- Font: Monospace (`Consolas`, `Monaco`, `Courier New`)
- Case: ALL CAPS
- Symbols: `✓` (allow), `✗` (deny), `?` (conditional), no symbol (service)
- Qualifiers: `OWN` (owner's data), `SVC` (service role)

---

## Source Spec

`features/foundation/000-rls-implementation/spec.md`

### User Stories

| Code | Priority | Title |
|------|----------|-------|
| US-001 | P0 | User Data Isolation |
| US-002 | P0 | Profile Self-Management |
| US-003 | P1 | Service Role Operations |
| US-004 | P2 | Audit Trail Protection |
| US-005 | P1 | Anonymous User Restrictions |

### FR Groups

- FR-001-005: Core table security
- FR-006-010: User data isolation
- FR-011-014: Service role access
- FR-015-018: Audit immutability
- FR-019-021: Anonymous restrictions
- FR-022-025: Pattern templates

---

## Execution

```bash
# 1. Delete existing
rm docs/design/wireframes/000-rls-implementation/*.svg

# 2. Generate fresh
/wireframe 000-rls-implementation

# 3. Update index.html (add 03 entry)
```
