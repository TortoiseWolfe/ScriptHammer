# Validator Escalation Audit

**Date**: 2026-01-15
**Terminal**: Validator
**Command**: `python3 validate-wireframe.py --check-escalation`

## Escalation Candidates Found

| Code        | Features Affected                                                               |
| ----------- | ------------------------------------------------------------------------------- |
| CALLOUT-003 | 006-template-fork-experience, 009-user-messaging-system                         |
| MOBILE-001  | 003-user-authentication, 004-mobile-first-design                                |
| MODAL-001   | 002-cookie-consent, 005-security-hardening, 013-oauth, 014-admin, 019-analytics |
| XML-004     | 004-mobile-first-design, 009-user-messaging-system                              |

## Analysis

### Current Validation Status

**All 30 SVGs PASS validation.** Escalation candidates originate from historical `.issues.md` files.

### Coverage Check

| Code        | Description             | Existing G-XXX  | Action                 |
| ----------- | ----------------------- | --------------- | ---------------------- |
| CALLOUT-003 | Callout overlaps button | G-031           | None - already covered |
| MOBILE-001  | Mobile y < 78           | G-034           | None - already covered |
| MODAL-001   | Modal overlay issues    | Partial (G-021) | Validator improvement  |
| XML-004     | Unquoted attributes     | None            | Already fixed          |

### MODAL-001 False Positives

Several MODAL-001 entries are documented false positives:

- `002-cookie-consent/03` - Settings page incorrectly flagged as modal
- `005-security-hardening/02` - Session management preview incorrectly flagged

**Root cause**: Validator detects "modal" text patterns but doesn't verify actual modal structure.

## Recommendations

1. **No new G-XXX entries needed** - Existing coverage is sufficient
2. **Clean stale issue files** - Remove fixed issues from `.issues.md`
3. **Improve MODAL-001 detection** - Only flag when actual modal overlay elements present

## Stale Issues to Clean

```bash
# Features with stale .issues.md files
docs/design/wireframes/002-cookie-consent/03-privacy-settings-page.issues.md
docs/design/wireframes/004-mobile-first-design/01-responsive-navigation.issues.md
docs/design/wireframes/005-security-hardening/02-session-timeout-warning.issues.md
docs/design/wireframes/009-user-messaging-system/01-connection-and-chat.issues.md
docs/design/wireframes/013-oauth-messaging-password/01-oauth-password-setup.issues.md
docs/design/wireframes/014-admin-welcome-email-gate/01-verification-gate.issues.md
docs/design/wireframes/019-google-analytics/01-consent-flow.issues.md
```

## Cleanup Completed (2026-01-15)

Cleaned 11 stale issue files:

| Feature                      | File                       | Issues Resolved     |
| ---------------------------- | -------------------------- | ------------------- |
| 002-cookie-consent           | 03-privacy-settings-page   | 1 (false positive)  |
| 003-user-authentication      | 01-registration-sign-in    | 1                   |
| 004-mobile-first-design      | 01-responsive-navigation   | 6 (false positives) |
| 005-security-hardening       | 02-session-timeout-warning | 1 (false positive)  |
| 006-template-fork-experience | 01-service-setup-guidance  | 1                   |
| 009-user-messaging-system    | 01-connection-and-chat     | 5                   |
| 009-user-messaging-system    | 02-settings-and-data       | 1                   |
| 013-oauth-messaging-password | 01-oauth-password-setup    | 14                  |
| 014-admin-welcome-email-gate | 01-verification-gate       | 3                   |
| 019-google-analytics         | 01-consent-flow            | 1                   |
| templates                    | dark-theme                 | text cleanup        |

**Post-cleanup verification**: `--check-escalation` now shows 0 candidates.

## Conclusion

Escalation mechanism working correctly. All stale issues cleaned. No new G-XXX entries needed.
