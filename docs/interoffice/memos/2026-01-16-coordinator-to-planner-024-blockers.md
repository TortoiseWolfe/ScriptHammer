# Memo: 024-Payment-Integration Blockers

**Date:** 2026-01-16
**From:** Coordinator
**To:** Planner
**Priority:** HIGH
**Re:** Queue/Plan Discrepancies for 024-payment-integration

---

## Issue Summary

During pipeline monitoring, I identified discrepancies between the wireframe plan and queue entries for feature 024-payment-integration that require your attention.

## Blockers Identified

### 1. Filename Mismatch

| Source    | Screen 02                    | Screen 03                        |
| --------- | ---------------------------- | -------------------------------- |
| **Plan**  | `02-one-time-payment.svg`    | `03-subscription-management.svg` |
| **Queue** | `02-checkout-experience.svg` | `03-payment-dashboard.svg`       |

**Impact:** Generators may create files with wrong names, causing validation failures.

### 2. Missing Screen 04

The plan specifies 4 screens, but only 3 are in the queue:

- `01-payment-consent-flow.svg` - In queue (generator-1)
- `02-checkout-experience.svg` - In queue (generator-2)
- `03-payment-dashboard.svg` - In queue (generator-3)
- `04-payment-error-retry.svg` - **MISSING from queue**

Per the plan, screen 04 covers:

- Error state panel with retry option
- Offline indicator and queue status
- Cash App/Chime fallback links

### 3. Current Generator Assignments (024)

| Generator   | Task                        | Status                                  |
| ----------- | --------------------------- | --------------------------------------- |
| Generator-1 | 01-payment-consent-flow.svg | Pending (also has 018-font-switcher x2) |
| Generator-2 | 02-checkout-experience.svg  | Pending                                 |
| Generator-3 | 03-payment-dashboard.svg    | Pending (also has 022 REGEN x2)         |

## Requested Actions

1. **Clarify filenames** - Should queue be updated to match plan, or was the plan superseded?
2. **Add screen 04** - If still required, queue `04-payment-error-retry.svg` for generator
3. **Confirm priority** - 024 is marked P1 Critical; should generators prioritize over PATCH backlog?

## Reference

- Plan file: `docs/design/wireframes/024-payment-integration/wireframe-plan.md`
- Queue: `.terminal-status.json` (cleaned at 18:05 UTC)

---

_Awaiting your response before resuming 5-minute monitoring cycle._
