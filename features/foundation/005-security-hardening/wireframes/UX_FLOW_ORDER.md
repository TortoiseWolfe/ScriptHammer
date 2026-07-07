# UX Flow Order: 005-security-hardening

**Created**: 2026-01-16
**Author**: UX Designer
**Based on**: Wireframe analysis (01-security-ux-enhancements.svg) + spec.md

## Visual Flow Analysis

The security hardening wireframe shows a sign-up form with progressive disclosure of security feedback. The natural user flow is top-to-bottom form completion.

### Spec User Stories (11 total)

| US     | Title                       | Priority | Wireframe Coverage                 |
| ------ | --------------------------- | -------- | ---------------------------------- |
| US-001 | Payment Data Isolation      | P0       | Not shown (backend)                |
| US-002 | OAuth Account Protection    | P0       | Not shown                          |
| US-003 | Brute Force Prevention      | P0       | ✓ Shown (lockout warning)          |
| US-004 | CSRF Protection             | P0       | Not shown (backend)                |
| US-005 | Malicious Data Prevention   | P1       | Not shown (backend)                |
| US-006 | Security Audit Trail        | P1       | Not shown (backend)                |
| US-007 | Email Validation            | P1       | ✓ Shown (email warning)            |
| US-008 | Password Strength           | P2       | ✓ Shown (strength meter)           |
| US-009 | Session Timeout             | P2       | See 02-session-timeout-warning.svg |
| US-010 | Error Recovery              | P2       | ✓ Shown (forgot password)          |
| US-011 | Pre-commit Secret Detection | P1       | Not shown (dev workflow)           |

### Recommended User Story Sequence (UX-Visible Only)

| Order | Callout | User Story                     | Screen Location               | Rationale                     |
| ----- | ------- | ------------------------------ | ----------------------------- | ----------------------------- |
| 1     | ②       | US-007: Email Validation       | Email input (top of form)     | First field user completes    |
| 2     | ③       | US-008: Password Strength      | Password field (middle)       | Progressive form completion   |
| 3     | ①       | US-003: Brute Force Prevention | Lockout warning (below form)  | Only shown on failure         |
| 4     | ④       | US-010: Error Recovery         | Forgot password link (bottom) | Recovery option after lockout |

### Visual Flow Map

```
Desktop Sign-Up Form (centered):
┌────────────────────────────────────────────┐
│ "Create Account"                           │
├────────────────────────────────────────────┤
│ ② EMAIL INPUT (y=160)                      │ ← US-007: Validate first
│    [user@tempmail.com]                     │
│    ⚠️ Disposable email warning             │
├────────────────────────────────────────────┤
│ ③ PASSWORD INPUT (y=280)                   │ ← US-008: Strength feedback
│    [••••••••••••]                          │
│    ████████░░░░ Strong                     │
│    Requirements: 8+ chars, upper, num, sym │
├────────────────────────────────────────────┤
│ CONFIRM PASSWORD (y=425)                   │
├────────────────────────────────────────────┤
│ [Create Account] button (y=490)            │
├────────────────────────────────────────────┤
│ ① LOCKOUT WARNING (y=555) [conditional]    │ ← US-003: On failure
│    ⛔ Account Temporarily Locked           │
│    "Too many failed attempts..."           │
├────────────────────────────────────────────┤
│ ④ Forgot password? (y=580)                 │ ← US-010: Recovery
└────────────────────────────────────────────┘
```

### Current vs Recommended

| Current Wireframe      | Recommended             | Change Needed            |
| ---------------------- | ----------------------- | ------------------------ |
| ① Lockout (below form) | ② Email (top)           | SPEC-ORDER: Swap ① and ② |
| ② Email                | ③ Password              | SPEC-ORDER: Renumber     |
| ③ Password             | ① Lockout (conditional) | SPEC-ORDER: Renumber     |
| ④ Error Recovery       | ④ Error Recovery        | None                     |

### Issue

Current callout order (①②③④) shows lockout warning first, but users encounter the form fields in a different order. The visual flow should match the user's natural progression through the form.

**Recommendation**: Renumber callouts to match top-to-bottom form completion order:

- ① Email Validation (first field)
- ② Password Strength (second field)
- ③ Form Submission (CTA)
- ④ Lockout/Error Recovery (failure states)

This aligns with the principle: happy path first, error states second.
