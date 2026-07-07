# Implementation Readiness Checklist: OAuth Messaging Password

**Purpose**: Validate plan.md + spec.md are complete, consistent, and unambiguous enough to drive `/speckit.tasks` and `/speckit.implement` without surprise rework.

**Created**: 2026-05-06
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md)
**Theme**: Implementation-readiness (depth: standard; audience: PR reviewer + LLM executing /speckit.implement)

---

## Scope clarity

- [x] Modal-vs-page primary path is explicit (FR-021, FR-022, plan.md "Source code" tree)
- [x] Setup-mode trigger condition is encoded in clarifications and FRs (`isOAuthUser(user) && !hasKeysForUser(user.id)`)
- [x] Email-user flow guaranteed unchanged (US-3 + FR-013, FR-014; regression-only Playwright spec named in plan)
- [x] /messages/setup page kept as fallback, not deleted (FR-022 + plan.md "NO CHANGE" line for setup/page.tsx)
- [x] Welcome-message dispatch extraction location explicit (`src/lib/messaging/welcome/send-welcome-message.ts`)
- [x] No new schema columns introduced (plan.md "No schema changes")

## Storage & security

- [x] Messaging password persistence is forbidden in unambiguous terms (FR-018 lists localStorage / sessionStorage / cookies / IndexedDB / "any other client-side store")
- [x] Recovery flow explicitly out of scope (FR-019 + spec.md Constraints)
- [x] Existing post-batch-8 invariant preserved: derived `CryptoKey` is non-extractable in IndexedDB (plan.md "Storage" section names it)
- [x] No new analytics or tracking events introduced (plan.md Constitution Check VI)

## UI conformance

- [x] Wireframe 01 (setup) and 02 (unlock) are signed off and linked from spec.md `## UI Mockup`
- [x] Provider badge text source named (`getOAuthProvider(user)`) and condition (`isOAuthUser(user)`)
- [x] WCAG AAA contrast preserved (plan.md Constitution Check; Phase 0 closure already enforces AAA)
- [x] 44px touch targets enforced (plan.md Constraints)
- [x] Mobile breakpoint constraint stated (360×720 with two-pw + confirm + badge fits) — flagged as a watch-out, must verify during implementation

## Test coverage

- [x] Unit-test list is concrete: setup-mode renders confirm field, unlock-mode does not, mismatch validation, submit branches by mode, badge conditional
- [x] Storybook story count specified (5: email-unlock, OAuth-Google setup/unlock, OAuth-GitHub setup/unlock)
- [x] New E2E spec path named (`tests/e2e/messaging/oauth-setup-modal.spec.ts`)
- [x] Existing E2E coverage retained (plan.md NO-CHANGE line for `tests/e2e/messaging/encrypted-messaging.spec.ts`)
- [x] Accessibility tests scoped (existing `.accessibility.test.tsx` runs against both modes)

## Cascade compliance

- [x] Wireframe gate (Constitution III) cleared before plan.md was written (validate.py PASSED 2026-05-06)
- [x] Clarifications session encoded with date heading per `/speckit.clarify` convention
- [x] No `[NEEDS CLARIFICATION]` markers remain in spec.md
- [x] All FRs reference concrete behavior, no vague adjectives
- [x] Constitution Check pass on all 6 principles documented in plan.md
- [x] Test-first ordering specified for `/speckit.tasks` (RED → GREEN → REFACTOR)

## Watch-outs flagged

- [x] Credential Management API behavior in modal vs page (cited as watch-out 2 in plan, plus session plan)
- [x] EncryptionKeyGate hot-path edit cited as watch-out 3 in session plan
- [x] Welcome-message extraction is the cleaner-long-term move (memory rule + session plan)
- [x] Local Supabase profile (`docker compose --profile supabase up`) named for manual smoke-test (memory rule)

---

## Validation Results

**Status**: PASSED — all items checked.

The plan and spec are concrete enough that `/speckit.tasks` can sequence the work
without re-asking decisions. Implementation is greenlighted.

## Notes

- Per `/speckit.checklist` "unit-tests-for-English" framing, this checklist
  validates **requirements quality**, not code correctness. The actual code-
  correctness gates live in the test suite (Vitest, Playwright, Pa11y) and run
  via the constitution's TDD cycle in `/speckit.implement`.
- The original `requirements.md` checklist (PASSED 2025-12-30) covered spec
  quality. This file covers the additional dimension of plan-readiness now that
  plan.md exists.
