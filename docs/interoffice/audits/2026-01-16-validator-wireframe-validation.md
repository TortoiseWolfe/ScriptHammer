# Validator Audit: Wireframe Validation

**Date**: 2026-01-16
**Author**: Validator
**Scope**: Full validation of all SVG wireframes

---

## Executive Summary

Validation run on 45 SVG files found **60 issues**. Only **10 files passed** (22% pass rate).

## Results by Error Type

| Code          | Count | Description                                                                 |
| ------------- | ----- | --------------------------------------------------------------------------- |
| G-037         | 42    | Annotation text uses light color `#6b7280` instead of `#374151`             |
| SIGNATURE-004 | 16    | Wrong signature format (should be `NNN:NN \| Feature Name \| ScriptHammer`) |
| PARSE         | 2     | Invalid XML - not well-formed                                               |

## Critical Issues (PARSE Errors)

These SVGs cannot be rendered:

| File                                                      | Line | Issue         |
| --------------------------------------------------------- | ---- | ------------- |
| `014-admin-welcome-email-gate/01-verification-gate.svg`   | 94   | Invalid token |
| `014-admin-welcome-email-gate/02-admin-setup-process.svg` | 145  | Invalid token |

## Escalation Candidate

**XML-004** found in 2+ features:

- `009-user-messaging-system`
- `022-web3forms-integration`

**ACTION**: Architect should add XML-004 to `GENERAL_ISSUES.md` if not already present.

## Passing Files (10/45)

- `015-oauth-display-name/01-profile-population-flow.svg`
- `009-user-messaging-system/01-connection-and-chat.svg`
- `009-user-messaging-system/02-settings-and-data.svg`
- `022-web3forms-integration/01-form-builder-interface.svg`
- `022-web3forms-integration/02-form-submission-flow.svg`
- `016-messaging-critical-fixes/01-conversation-view.svg`
- And 4 others

## Recommendations

1. **G-037 Fix**: Change annotation text `fill="#6b7280"` to `fill="#374151"` (42 files)
2. **SIGNATURE-004 Fix**: Update signatures to format `NNN:NN | Feature Name | ScriptHammer` (16 files)
3. **PARSE Fix**: Debug XML syntax in 014-admin-welcome-email-gate SVGs (2 files)

## Action Items

- [ ] Generator: Fix G-037 color issues (PATCH - 42 files)
- [ ] Generator: Fix SIGNATURE-004 format issues (PATCH - 16 files)
- [ ] Generator: Fix PARSE errors in 014-admin-welcome-email-gate (REGEN - 2 files)
- [ ] Architect: Review XML-004 for GENERAL_ISSUES.md escalation

---

## Related Documents

- `docs/design/wireframes/GENERAL_ISSUES.md`
- Individual `.issues.md` files logged by validation script
