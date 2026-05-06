# Cross-Artifact Analysis: OAuth Messaging Password

**Generated**: 2026-05-06 by `/speckit.analyze` step
**Mode**: Read-only consistency check across [spec.md](./spec.md), [plan.md](./plan.md), [tasks.md](./tasks.md), and `.specify/memory/constitution.md` v1.0.2
**Note**: `scripts/constitution-check.py` is out-of-date (expects old `<feature>/spec/spec.md` layout; current layout is flat `<feature>/spec.md`). Manual analysis below.

---

## A. Summary

**Status**: PASS — all 6 categories below verify clean. No blocking issues. Implementation can proceed via `/speckit.implement`.

| Category                          | Result  | Notes                                                                                             |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| FR coverage in tasks.md           | ✅ PASS | All 22 FRs traced to at least one task or marked as already-shipped.                              |
| User-story → task mapping         | ✅ PASS | US-1 → T002–T008, US-2 → T009–T012, US-3 → T013–T015. Each story independently testable.          |
| Plan ↔ tasks file-path alignment | ✅ PASS | All file paths in tasks.md match plan.md "Source code" tree.                                      |
| Constitution compliance           | ✅ PASS | All 6 principles verified (see Section E).                                                        |
| Wireframe coverage in tasks       | ✅ PASS | Wireframe 01 (setup) drives T006 + T011 copy/layout. Wireframe 02 (unlock) drives T011.           |
| Cascade discipline                | ✅ PASS | All v1.0.2 cascade steps walked in order: specify → clarify → wireframe → plan → tasks → analyze. |

---

## B. FR-to-task traceability matrix

Every functional requirement maps to a task (or is marked already-shipped).

| FR     | Statement                                                            | Task(s)                              | Status                                                                  |
| ------ | -------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| FR-001 | Detect OAuth user                                                    | (already shipped)                    | `isOAuthUser` exists                                                    |
| FR-002 | Detect existing encryption keys                                      | (already shipped)                    | `hasKeysForUser` exists                                                 |
| FR-003 | Distinguish OAuth from email/password users                          | (already shipped)                    | both helpers exist                                                      |
| FR-004 | Show "Create a Messaging Password" mode for OAuth users without keys | T006, T007                           | New                                                                     |
| FR-005 | Setup mode includes password + confirm fields                        | T006                                 | New                                                                     |
| FR-006 | Validate passwords match                                             | T006 + T004 (test)                   | New                                                                     |
| FR-007 | Display password strength feedback                                   | T006 (existing minLength=8 bound)    | Reused                                                                  |
| FR-008 | Explain why a separate messaging password is needed                  | T006 (warning copy per wireframe 01) | New                                                                     |
| FR-009 | Show "Unlock Your Messages" mode for OAuth users with keys           | T011                                 | Polish                                                                  |
| FR-010 | Unlock mode shows single password field                              | (already shipped)                    | unchanged                                                               |
| FR-011 | Subtext explains password is separate from OAuth credentials         | T011                                 | Polish                                                                  |
| FR-012 | Identify OAuth provider                                              | T006, T011                           | Provider badge                                                          |
| FR-013 | Email user sees unchanged behavior                                   | T013, T014                           | Regression-tested                                                       |
| FR-014 | No OAuth-specific messaging to email users                           | T014                                 | Regression-tested                                                       |
| FR-015 | Form fields have proper labels                                       | (already shipped)                    | preserved                                                               |
| FR-016 | Error messages announced to assistive tech                           | T005, T006                           | Preserved + tested                                                      |
| FR-017 | Focus management on mode change                                      | T005, T006                           | Preserved + tested                                                      |
| FR-018 | NEVER persist messaging password                                     | T006                                 | Enforced by construction (no setState/localStorage write of `password`) |
| FR-019 | NO recovery flow                                                     | (out of scope)                       | Spec.md Constraints                                                     |
| FR-020 | Visual provider badge from `getOAuthProvider(user)`                  | T006, T011                           | New                                                                     |
| FR-021 | Modal opens in setup mode inline; no redirect                        | T007                                 | EncryptionKeyGate flip                                                  |
| FR-022 | `/messages/setup` page kept as fallback                              | (no-change)                          | Plan.md NO-CHANGE annotation                                            |

**No orphan FRs.** Every requirement has a home.

---

## C. User-story independence

Each story has a discrete acceptance test that can run in isolation:

- **US-1** (T008 checkpoint): OAuth user no-keys → modal setup mode → submit → routes to `/messages`. Independent of US-2 (no existing keys to unlock) and US-3 (different user).
- **US-2** (T012 checkpoint): OAuth user with keys + cleared IndexedDB → modal unlock mode → submit → routes to `/messages`. Independent of US-1 (different setup) and US-3.
- **US-3** (T015 checkpoint): Email user → modal unlock mode → byte-identical to pre-feature behavior. Independent of US-1/US-2.

**Shippable boundaries:**

- T001–T008 ship US-1 alone (the largest scope, MVP).
- T009–T012 add US-2 polish.
- T013–T015 pin US-3 invariants without code change (regression tests only).

---

## D. File-path alignment

Plan.md "Source code" tree files vs tasks.md file paths:

| File                                                                 | Plan says        | Tasks reference          | Match              |
| -------------------------------------------------------------------- | ---------------- | ------------------------ | ------------------ |
| `src/components/auth/ReAuthModal/ReAuthModal.tsx`                    | EXTEND           | T006, T011               | ✅                 |
| `src/components/auth/ReAuthModal/ReAuthModal.test.tsx`               | EXTEND           | T004, T010, T014         | ✅                 |
| `src/components/auth/ReAuthModal/ReAuthModal.accessibility.test.tsx` | EXTEND           | T005                     | ✅                 |
| `src/components/auth/ReAuthModal/ReAuthModal.stories.tsx`            | grow 1→5         | T016                     | ✅                 |
| `src/components/auth/EncryptionKeyGate/EncryptionKeyGate.tsx`        | MODIFY line 78   | T007                     | ✅                 |
| `src/app/messages/setup/page.tsx`                                    | NO CHANGE except | T002 (one-line refactor) | ✅ (allowed minor) |
| `src/lib/messaging/welcome/send-welcome-message.ts`                  | NEW              | T001                     | ✅                 |
| `tests/e2e/messaging/oauth-setup-modal.spec.ts`                      | NEW              | T003, T009, T013         | ✅                 |
| `src/lib/auth/oauth-utils.ts`                                        | NO CHANGE        | (no task touches)        | ✅                 |
| `src/services/messaging/key-service.ts`                              | NO CHANGE        | (no task touches)        | ✅                 |

**One nuance**: Plan.md says `setup/page.tsx` is "NO CHANGE", but T002 makes a small refactor (extract welcome-message dispatch to the new helper). This is a minor inconsistency — the refactor is necessary so both modal AND page paths share the helper. **Resolution**: T002 is the cleaner-long-term move per memory rule; the plan should be read as "no behavior change" rather than "no diff at all". Already noted in plan.md "Source Decision" paragraph.

---

## E. Constitution v1.0.2 compliance

| Principle                                       | Compliance | Where verified                                                                                                                                                              |
| ----------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Component Structure (5-file pattern)         | ✅         | ReAuthModal already 5-file; tasks T004/T005/T016 update existing test/a11y/stories files in place. No new component dirs.                                                   |
| II. Test-First Development                      | ✅         | Tasks T003, T004, T005 (RED) precede T006 (GREEN). T009, T010 (RED) precede T011 (GREEN). T013, T014 (regression) ship as part of US-3 by design.                           |
| III. PRP Methodology + Mandatory Wireframe Gate | ✅         | Cascade order: spec.md (clarifications encoded) → wireframes (PASSED) → plan.md → tasks.md → analysis.md → next: implement. T018 schedules post-implement screenshots step. |
| IV. Docker-First Development                    | ✅         | Every task that runs commands prefixes with `docker compose exec scripthammer ...`. T008, T012, T015, T017, T018, T019 are all containerized.                               |
| V. Progressive Enhancement                      | ✅         | Modal already client-only; mobile-first preserved (44px touch targets, mobile breakpoint flagged in plan watch-out). No JS-required-for-core-flow regressions.              |
| VI. Privacy & Compliance First                  | ✅         | FR-018 forbids password persistence in any client-side store. FR-019 keeps recovery flow out-of-scope. No new analytics events.                                             |

---

## F. Risks & follow-ups

### Already-known watch-outs (from plan.md + session plan, all flagged)

1. Modal-setup mode mobile height — must verify in browser at 360×720 during T006/T018.
2. Credential Management API auto-fill differences in modal vs page — verify in Chrome + Firefox during T018 manual smoke.
3. EncryptionKeyGate hot-path edit — T007 must preserve email-user redirect to `/messages/setup` when they have no keys (only OAuth users get the modal setup path).
4. Welcome-message extraction (T001 + T002) — both modal-setup and page-setup paths must dispatch the welcome message; covered by extracting once and calling from both.

### New finding from analysis (low-impact)

- `scripts/constitution-check.py` expects an outdated `<feature>/spec/spec.md` layout. **Recommendation**: file a separate issue and PR to fix the script's `spec_dir = feature_dir / "spec"` to `spec_dir = feature_dir`. Not a blocker for #28; a one-line fix that benefits all future `/speckit.analyze` invocations. **Out of scope for this feature.**

---

## G. Recommendation

**Proceed to `/speckit.implement`.** No remediation needed. The cascade is intact, constitution is satisfied, FRs are traceable, user stories are independent, file paths align.
