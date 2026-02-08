# DEC-005: Constitution v1.1.0 - Planning Phase Language Corrections

**Date**: 2026-01-15
**RFC**: RFC-005
**Status**: active

## Stakeholder Votes

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-15 |
| Architect     | approve | 2026-01-15 |
| Security Lead | approve | 2026-01-15 |
| Toolsmith     | approve | 2026-01-15 |
| DevOps        | approve | 2026-01-15 |
| Product Owner | approve | 2026-01-15 |

**Result**: Unanimous approval (6-0)

## Decision

Amend Constitution Section I to correct two provably false statements about the component generator and build failure enforcement. These corrections align the document with ScriptHammer's planning-phase reality while preserving the architectural intent.

## Rationale

The Developer audit (2026-01-15-constitution-gaps.md) identified that Constitution Section I contains statements that are demonstrably false:

1. **Generator command**: `pnpm run generate:component` is documented but does not exist
2. **Build failure claim**: "manual component creation will cause build failures" - no such validation exists

A contributor following these instructions today would:

- Encounter `command not found` when running the generator
- Successfully create manual components without any build failure

This undermines constitution credibility and could cause contributor confusion.

## Dissenting Views

None recorded. All council members approved unanimously.

## Impact

| Area                   | Impact                                  |
| ---------------------- | --------------------------------------- |
| Existing code          | None (no code exists)                   |
| Contributors           | Clarity - no false instructions         |
| CI/CD                  | None - describes future validation      |
| Implementation order   | Generator becomes explicit prerequisite |
| Constitution authority | Strengthened - no false claims          |

## Implementation

- [x] Edit `.specify/memory/constitution.md` with approved changes
- [x] Update version to 1.1.0
- [x] Update Last Amended date to 2026-01-15
- [ ] Announce via /broadcast

### Approved Amendment Text

**Section I, Lines 9-10** - Replace:

> Use the component generator (`pnpm run generate:component`) to ensure compliance. No exceptions are permitted - manual component creation will cause build failures.

With:

> Use the component generator (`pnpm run generate:component`) to ensure compliance. The generator script MUST be created as the first implementation task before any component work begins. No exceptions are permitted - CI validation WILL enforce this pattern once implemented.

**Version line** - Update to:

> **Version**: 1.1.0 | **Ratified**: 2025-12-29 | **Last Amended**: 2026-01-15
