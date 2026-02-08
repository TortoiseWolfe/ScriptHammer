# Dependency Graph

Generated: 2026-01-15 | Source: `features/IMPLEMENTATION_ORDER.md` | Refresh: `/refresh-inventories`

## Tier Overview

| Tier | Focus              | Features                                    |
| ---- | ------------------ | ------------------------------------------- |
| 1    | Foundation         | 000, 003, 007, 006, 002, 001                |
| 2    | Consent & Security | 005, 019                                    |
| 3    | Core Messaging     | 009, 011, 012, 013, 016, 014, 015, 043, 026 |
| 4    | Payments           | 024, 042, 038, 039, 040, 041                |
| 5    | Content & Blog     | 010, 025, 029, 022, 023                     |
| 6    | Enhancements       | 017, 018, 020, 021, 028, 030                |
| 7    | Polish             | 027, 008                                    |
| 8    | Testing            | 031-037                                     |
| 9    | Third-Party        | 044, 045                                    |

## Key Blockers

```
000-RLS ──────> 003-Auth ──────> ALL authenticated features
019-Consent ──> 044-Sentry, 045-Disqus
024-Payment ──> 038-Dashboard, 039-Offline, 040-Retry, 041-PayPal
007-E2E ──────> 031-037 (all tests)
009-Messaging ─> 011-Groups ──> 012-Welcome ──> 014-Gate
```

## Feature Dependencies (Quick Reference)

| Feature       | Depends On | Blocks                                |
| ------------- | ---------- | ------------------------------------- |
| 000-RLS       | None       | 003, 024, 042                         |
| 003-Auth      | 000        | 005, 009, 013-016, 024, 030, 032, 036 |
| 007-E2E       | None       | 031-037                               |
| 019-Consent   | None       | 044, 045                              |
| 024-Payment   | 000, 003   | 038-041                               |
| 009-Messaging | 003        | 011, 026, 043                         |
| 010-Blog      | 002        | 025, 029, 034                         |
| 001-WCAG      | None       | 017, 018, 037                         |

## Wave-Based Parallel Implementation

| Wave   | Features                          | Can Start After       |
| ------ | --------------------------------- | --------------------- |
| Wave 1 | 000, 003, 007, 006, 002, 001      | Immediately           |
| Wave 2 | 005, 019, 020                     | Wave 1                |
| Wave 3 | 009, 011, 012, 016, 013, 014, 015 | Wave 2                |
| Wave 4 | 024, 042, 038, 039, 040, 041      | Wave 2                |
| Wave 5 | 010, 025, 029, 017, 018, 022, 023 | Wave 1                |
| Wave 6 | 021, 028, 026, 027, 030, 008, 043 | Wave 3                |
| Wave 7 | 031-037                           | Wave 1 (007 complete) |
| Wave 8 | 044, 045                          | Wave 2 (019 complete) |
