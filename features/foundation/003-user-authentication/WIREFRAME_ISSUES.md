# Wireframe Issues: 003-user-authentication

## Summary
- **Files reviewed**: 5 SVGs
- **Issues found**: 8 total (Pass 1-4), 7 (Pass 5), 1 (Pass 6), 4 (Pass 7), 2 (Pass 8), 1 (Pass 9), 1 (Pass 10)
- **Status**: ✅ COMPLETE
- **Reviewed on**: 2026-01-02

## Review History
| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1 | 2026-01-01 | 5 | - | 5 | 5 |
| 2 | 2026-01-01 | 0 | 5 | 0 | 0 |
| 3 | 2026-01-01 | 3 | - | 3 | 3 (visual inspection by user) |
| 4 | 2026-01-01 | 0 | 3 | 0 | 0 (regenerated 05-auth-flow-architecture.svg) |
| 5 | 2026-01-02 | 7 | 7 | 0 | 0 (re-review with updated /wireframe template) |
| 6 | 2026-01-02 | 1 | 1 | 0 | 0 (added color legend + fixed template) |
| 7 | 2026-01-02 | 4 | 4 | 0 | 0 (abbreviations, strokes, button spacing) |
| 8 | 2026-01-02 | 2 | 2 | 0 | 0 (regressions: HOC overflow, arrow overlap) |
| 9 | 2026-01-02 | 1 | 1 | 0 | 0 (green line through "unverified" - moved to y=85) |
| 10 | 2026-01-02 | 1 | 1 | 0 | 0 (messy arrows → clean horizontal routing) |

---

## Pass 5: Updated Template Compliance Review (2026-01-02)

Re-reviewed `05-auth-flow-architecture.svg` against updated `/wireframe` command template with **mandatory font size minimums**.

### 🔴 CRITICAL: Font Sizes Below Mandatory Minimums (FIXED)

The previous version used reduced font sizes that violated the template rules:

| Class | Previous | Required | Status |
|-------|----------|----------|--------|
| `.heading-lg` | 20px | **24px** | ✅ FIXED |
| `.heading` | 14px | **16px** | ✅ FIXED |
| `.heading-sm` | 12px | **14px** | ✅ FIXED |
| `.text-md` | 12px | **14px** | ✅ FIXED |
| `.text-sm` | 10px | **13px** | ✅ FIXED |
| `.text-muted` | 10px | **12px** | ✅ FIXED |

### 🟡 WARNING: Success Criteria Labels Missing Context (FIXED)

Previous cryptic labels like `SC-001: <3 min` now include context:

| Previous | Updated |
|----------|---------|
| `SC-001: <3 min` | `SC-001: Signup flow completes in <3 min` |
| `SC-002: <2 sec` | `SC-002: Sign-in response <2 sec (95%)` |
| `SC-003: 1K users` | `SC-003: 1,000 concurrent sessions` |
| `SC-004: 0 breach` | `SC-004: Zero unauthorized access` |
| `SC-005: <2 min` | `SC-005: Password reset <2 min` |
| `SC-006: <10 sec` | `SC-006: OAuth sign-in <10 sec` |
| `SC-007: <1 sec` | `SC-007: Audit log latency <1 sec` |
| `SC-008: 100%` | `SC-008: 100% expired session redirect` |

### Resolution

**Action**: 🔴 REGENERATE - Complete regeneration with:
- Canvas expanded from 1400×800 to **1600×1000** for larger fonts
- All font sizes now meet mandatory minimums
- Success Criteria labels include full context
- All layout proportions adjusted for readability

---

## Pass 6: Color Legend Addition (2026-01-02)

### Issue Found
The Compliance section uses colored borders to encode semantic meaning but lacked a legend:

| Border Color | Used By | Meaning |
|--------------|---------|---------|
| `#22c55e` (green) | PCI Ready, GDPR Compliant | Compliance achieved |
| `#8b5cf6` (purple) | Static Export (GitHub Pages) | Technical constraint |
| `#f59e0b` (orange) | External Auth Service | External dependency |
| `#475569` (gray) | 99.9% Uptime, >95% Email | Target metric |

### Resolution

**Action**: Added color legend group at y=900:
- Legend positioned between Compliance section and footer
- Shows all 4 color categories with labeled swatches
- Template updated to include legend placeholder for future diagrams

**Root Cause Fix**: Updated `/wireframe` Dark Theme Template to include optional legend section by default

---

## Pass 7: Abbreviations, Strokes, Layout (2026-01-02)

User feedback identified 4 issues:

### 🟢 PATCHABLE: Abbreviations Not Defined (FIXED)

| Before | After |
|--------|-------|
| `PCI Ready` | `PCI (Payment Card) Ready` |
| `GDPR Compliant` | `GDPR (Data Protection) Compliant` |
| `Guard HOC` | `Guard HOC (Higher-Order Component)` |

**Root Cause Fix**: Added "Abbreviation Rule (MANDATORY)" section to wireframe.md template

### 🟢 PATCHABLE: Grey Outline Missing (FIXED)

Target metric rects had no `stroke` attribute:
- Added `stroke="#475569"` to 99.9% Uptime Target rect
- Added `stroke="#475569"` to >95% Email Delivery rect

### 🟢 PATCHABLE: Access/Verify Buttons Touching (FIXED)

Buttons had no gap between them:
- Access: y=55, height=44 → ends at y=99
- Verify: was y=99 → now y=107 (8px gap)
- Sign In: was y=148 → now y=159 (8px gap)

---

## Pass 8: Regressions from Pass 7 (2026-01-02)

User review caught 2 regressions introduced by Pass 7 fixes:

### 🟢 PATCHABLE: HOC Expansion Overflow (FIXED)

"Guard HOC (Higher-Order Component)" was ~35 chars in a 145px wide rect - overflowed container.

**Fix**: Split into 2 lines:
- Line 1: "Guard HOC" at y=100
- Line 2: "(Higher-Order Component)" at y=115

### 🟢 PATCHABLE: Arrow Through "unverified" Text (FIXED)

The "unverified" label (y=120) overlapped with arrow path ending at y=120.

**Fix**: Moved label from y=120 to y=103 (above the arrow)

---

## Pass 9: Green Line Through "unverified" (2026-01-02)

Pass 8 fix moved "unverified" from y=120 to y=103, but this placed the text body (which extends ~12px above baseline) directly over the green horizontal arrow segment at y=100.

### 🟢 PATCHABLE: Green Arrow Through "unverified" (FIXED)

**Problem**: Text at y=103 with ~12px font height extends from y~91 to y=103, overlapping the green arrow at y=100.

**Fix**: Moved "unverified" label from y=103 to y=85 (15px above the green line at y=100)

**Visually verified** using browser tools before marking complete.

---

## Pass 10: Clean Arrow Routing (2026-01-02)

User feedback: Route Protection arrows were messy bent/diagonal paths that looked unprofessional.

### 🔴 REGENERATE: Messy Arrow Routing (FIXED)

**Problem**: Original arrows used bent L-shaped and diagonal paths:
```xml
<!-- OLD - MESSY -->
<path d="M 300 100 L 340 100 L 340 75 L 400 75" .../>  <!-- Green: bent L-shape -->
<path d="M 300 112 L 400 120" .../>                     <!-- Orange: diagonal -->
<path d="M 300 125 L 340 125 L 340 163 L 400 163" .../> <!-- Red: bent L-shape -->
```

**Fix**: Complete redesign with clean horizontal arrows:
```xml
<!-- NEW - CLEAN HORIZONTAL -->
<path d="M 300 77 L 400 77" .../>   <!-- Green: straight horizontal at y=77 -->
<path d="M 300 129 L 400 129" .../> <!-- Orange: straight horizontal at y=129 -->
<path d="M 300 181 L 400 181" .../> <!-- Red: straight horizontal at y=181 -->
```

**Changes**:
- All 3 arrows now use clean straight horizontal paths
- Labels positioned above each arrow line
- Destination boxes aligned with arrow endpoints
- Professional appearance matching the rest of the diagram

**Visually verified** in browser - clean horizontal routing confirmed.

---

## Previously Fixed Issues (Pass 1-4)

| # | Issue | File | Status |
|---|-------|------|--------|
| 1 | Remember me checkbox 16x16 → 44x44 | 01-login-signup.svg | ✅ FIXED |
| 2 | Mobile text overflow (false positive) | 03-email-verification.svg | ✅ FALSE POSITIVE |
| 3 | Revoke link 60x24 → 60x44 | 04-profile-settings.svg | ✅ FIXED |
| 4 | Annotations at y=735 → y=750 | 04-profile-settings.svg | ✅ FIXED |
| 5 | Muted text contrast #64748b → #8494a8 → #b4bcc8 | 05-auth-flow-architecture.svg | ✅ FIXED |
| 6 | Lines crossing at y=100 | 05-auth-flow-architecture.svg | ✅ FIXED |
| 7 | Text labels clipped by boxes | 05-auth-flow-architecture.svg | ✅ FIXED |
| 8 | Verify and Sign In boxes touching | 05-auth-flow-architecture.svg | ✅ FIXED |

---

## Files Status

| File | Status | Notes |
|------|--------|-------|
| 01-login-signup.svg | ✅ PASS | Fixed touch target |
| 02-password-reset.svg | ✅ PASS | No issues |
| 03-email-verification.svg | ✅ PASS | False positive verified |
| 04-profile-settings.svg | ✅ PASS | Fixed touch targets + spacing |
| 05-auth-flow-architecture.svg | ✅ PASS | Regenerated with correct font sizes (1600×1000 canvas) |

---

## Result

**All 5 wireframes pass - Ready for Phase 3 (`/speckit.plan`)**

## Cleanup

Delete reference file after verification:
```bash
rm docs/design/wireframes/003-user-authentication/05-auth-flow-architecture.reference.svg
```
