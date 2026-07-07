# Implementation Plan: Row Level Security Foundation

**Branch**: `000-rls-implementation` | **Date**: 2026-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/000-rls-implementation/spec.md`

## Summary

Implement foundational Row Level Security (RLS) policies for all Supabase tables to establish security patterns before domain-specific features. This includes owner isolation policies for users/profiles/sessions tables, immutable audit logging, service role bypass for backend operations, and anonymous access restrictions. All policies will use simple, performant patterns optimized for query execution.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 15+), SQL (PostgreSQL 15+ via Supabase)
**Primary Dependencies**: @supabase/supabase-js, @supabase/ssr
**Storage**: PostgreSQL via Supabase (RLS-enabled tables)
**Testing**: Vitest (unit), Playwright (E2E), custom RLS test harness
**Target Platform**: Static web (GitHub Pages) + Supabase backend
**Project Type**: web
**Performance Goals**: <10ms policy evaluation latency per query (SC-004)
**Constraints**: Static export only, no server-side API routes, secrets in Supabase Vault only
**Scale/Scope**: 1,000-10,000 users, <1M rows per table (from spec clarifications)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Applies | Status | Notes                                      |
| ---------------------------- | ------- | ------ | ------------------------------------------ |
| I. 5-file component pattern  | NO      | N/A    | RLS is backend/database - no UI components |
| II. Test-First Development   | YES     | PASS   | Will write RLS test cases before policies  |
| III. PRP Methodology         | YES     | PASS   | Following SpecKit workflow                 |
| IV. Docker-First Development | YES     | PASS   | All work in Docker containers              |
| V. Progressive Enhancement   | NO      | N/A    | Backend feature, no UI                     |
| VI. Privacy & Compliance     | YES     | PASS   | RLS enables GDPR compliance                |

**Gate Status**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/000-rls-implementation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (RLS policy definitions)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Web application with Supabase backend
supabase/
├── migrations/
│   └── 00000000000000_rls_foundation.sql   # Idempotent RLS policies
├── seed.sql                                 # Test data for RLS verification
└── config.toml                              # Supabase project config

src/
├── lib/
│   └── supabase/
│       ├── client.ts        # Browser client (anon key)
│       ├── server.ts        # Server client (service role)
│       └── middleware.ts    # Auth session handling
└── types/
    └── database.ts          # Generated types from Supabase

tests/
├── rls/
│   ├── user-isolation.test.ts      # Cross-user access tests
│   ├── service-role.test.ts        # Backend operation tests
│   ├── audit-immutability.test.ts  # Audit log protection tests
│   └── anonymous-access.test.ts    # Unauthenticated user tests
└── fixtures/
    └── test-users.ts               # Test user factory
```

**Structure Decision**: Web application pattern with Supabase backend. RLS policies defined in migrations folder, tested via dedicated test suite in tests/rls/.

## Complexity Tracking

> No violations requiring justification - complexity is appropriate for feature scope.
