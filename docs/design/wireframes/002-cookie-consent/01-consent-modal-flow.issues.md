# Issues: 01-consent-modal-flow.svg

**Feature:** 002-cookie-consent
**SVG:** 01-consent-modal-flow.svg
**Reviewed:** 2026-01-11
**Validator:** v2.1

---

## Summary

| Status | Count |
|--------|-------|
| Resolved | 4 |
| Open | 1 |

---

## Resolved Issues

### Issue 1: Template Injection
**Status:** Resolved
**Classification:** Was missing, now complete

All 4 templates properly injected:
- `desktop-header` at (10, 10)
- `site-footer` at (10, 640)
- `mobile-header-group` at (10, 10)
- `mobile-bottom-nav` at (10, 654)

### Issue 2: Mobile Frame Color
**Status:** Resolved
**Classification:** Was dark (#1f2937), now light (#e8d4b8)

Mobile frame uses light parchment color, passes MOB-001.

### Issue 3: Clickable Badges
**Status:** Resolved
**Classification:** All FR/SC badges wrapped in `<a href>`

All badge pills are clickable links to spec sections.

### Issue 4: Font Sizes
**Status:** Resolved
**Classification:** All text >= 14px (except 11-12px badge text inside links, allowed)

---

## Open Issues

### Issue 5: Incomplete FR/SC Coverage
**Status:** Open
**Classification:** REGENERATE
**Priority:** Medium

#### Current Coverage (6 groups)

| Group | FRs | SCs |
|-------|-----|-----|
| Consent Modal | FR-001, FR-003 | SC-001 |
| Three Equal Options | FR-002, FR-004 | - |
| Category Toggles | FR-005, FR-006, FR-007, FR-008 | - |
| Privacy Settings Link | FR-011 | SC-004 |
| Accessibility | FR-022, FR-023, FR-024 | SC-006 |
| Preference Persistence | FR-009, FR-012 | SC-003 |

**Total covered:** 15 FRs, 4 SCs

#### Missing Requirements

| Category | Missing FRs | Missing SCs |
|----------|-------------|-------------|
| Versioning & Audit | FR-010, FR-013, FR-014, FR-015 | SC-002, SC-005 |
| Data Rights | FR-016, FR-017, FR-018 | SC-007 |
| Granular Controls | FR-019, FR-020, FR-021 | SC-008 |

**Total missing:** 9 FRs, 4 SCs

#### Recommended Fix

Add 2 annotation groups to Row 2 (bringing total to 8 groups):

**Group 7: Versioning & Audit**
```
- FR-010: Version tracking for consent changes
- FR-013: Consent receipts/proof
- FR-014: Audit logging
- FR-015: Compliance export
- SC-002: Compliance verification metrics
- SC-005: Audit trail completeness
```

**Group 8: Data Rights & Granular Controls**
```
- FR-016: Right to access consent data
- FR-017: Right to data portability
- FR-018: Right to deletion
- FR-019: Per-vendor consent options
- FR-020: Per-purpose consent options
- FR-021: Consent duration controls
- SC-007: Data rights response time
- SC-008: Granular control accuracy
```

---

## Notes

### Callout #4 Positioning
- Desktop: At (660, 15) in footer - near Privacy link (acceptable)
- Mobile: At (360, 28) - intentionally off-screen to avoid blocking nav

**User decision:** Off-screen preferred over blocking UI elements.

### Red Corner Marks
User reported red L-shaped marks at mockup corners in viewer.
- Not in SVG source
- Not in viewer JavaScript
- Likely from screenshot tool, browser extension, or dev tools
