# Review Notes: Critical Messaging UX Fixes

**Reviewed**: 2025-12-30
**Feature ID**: 016
**Lines**: 101 (Lightweight PRP)

## Compliance Scores (/28 total)

| Category                | Score | Notes                                        |
| ----------------------- | ----- | -------------------------------------------- |
| Static Export           | 4/4   | Client-side fixes, no /api/ routes           |
| Supabase Architecture   | 4/4   | Uses existing tables properly                |
| 5-File Components       | 2/3   | Key entities defined, not explicit structure |
| TDD Compliance          | 5/5   | SC-001 mentions Playwright visual tests      |
| Progressive Enhancement | 4/5   | Responsive design 320px-1920px               |
| Privacy/GDPR            | 4/4   | Graceful fallbacks for deleted users         |
| Docker-First            | 2/2   | Follows project patterns                     |

**Total**: 25/28 (89%) - COMPLIANT

## Issues Found

### P2 - Medium Priority

1. **Overlaps with Feature 013**
   - US-2 (OAuth Password Setup) duplicates 013's core functionality
   - **Fix**: Consolidate into single implementation, reference other feature

### P3 - Low Priority

2. **5 issues in one feature - consider splitting**
   - US-1: CSS layout fix
   - US-2: OAuth password flow (overlap with 013)
   - US-3: Password manager integration
   - US-4: Decryption failure UX
   - US-5: Participant name resolution
   - **Fix**: Consider if these should be separate features for cleaner tracking

## Missing Requirements

- None critical - comprehensive for scope

## Ambiguous Acceptance Criteria

- None - well-defined per user story

## Dependencies

- **Depends on**: 009-user-messaging-system, 013, 015
- **Depended on by**: None (polish feature)

## Ready for SpecKit: YES (with overlap resolution)

**Notes**: Good collection of critical fixes. FR-008 distinguishes setup mode (zero valid keys) from unlock mode (keys exist but not loaded) - important distinction. Password manager integration (autocomplete attributes) is thoughtful.
