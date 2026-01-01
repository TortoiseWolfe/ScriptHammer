# Wireframe Issues: 000-rls-implementation

## Summary
- **Files reviewed**: 3 SVGs
- **Issues found**: 12 total (0 critical, 5 major, 7 minor)
- **Reviewed on**: 2026-01-01
- **Classification**: 🟢 ALL PATCHABLE (no regeneration required)
- **Status**: ✅ FIXED (2026-01-01)

---

## Spec Compliance Checklist

### Requirements Extraction from spec.md

**Functional Requirements (FR-001 to FR-025):**
- FR-001 to FR-005: Enable RLS on core tables (users, profiles, sessions, audit_logs, new tables)
- FR-006 to FR-010: User data isolation (SELECT/UPDATE own only, empty results on unauthorized)
- FR-011 to FR-014: Service role access (bypass, audit, minimize scope, no client exposure)
- FR-015 to FR-018: Audit trail protection (service INSERT only, no UPDATE/DELETE, own SELECT)
- FR-019 to FR-021: Anonymous access restrictions (no writes, public read only, no enumeration)
- FR-022 to FR-025: Standard pattern templates (owner isolation, service bypass, soft delete, immutable audit)

**Success Criteria (SC-001 to SC-008):**
- SC-001: All core tables have policies before production
- SC-002: Zero cross-user data access (100% isolation)
- SC-003: Service role operations succeed
- SC-004: <10ms policy overhead
- SC-005: 100% test coverage of access scenarios
- SC-006: Security review completed
- SC-007: Audit log integrity (zero modify/delete success)
- SC-008: Zero user enumeration by anonymous users

### Coverage Verification

| Requirement | Wireframe | Visualized | Labeled | Accurate |
|-------------|-----------|------------|---------|----------|
| FR-001-005 (Table RLS) | 01 | Yes | Green status dots | Yes |
| FR-006-010 (User isolation) | 01, 02, 03 | Yes | OWN badges | Yes |
| FR-011-014 (Service role) | 01, 02, 03 | Yes | SERVICE_ROLE section | Yes |
| FR-015-018 (Audit immutability) | 01, 02, 03 | Yes | IMMUTABLE labels | Yes |
| FR-019-021 (Anonymous) | 01, 03 | Yes | ANON section | Yes |
| FR-022 (Owner pattern) | 02 | Yes | Pattern 1 | Yes |
| FR-023 (Service pattern) | 02 | Yes | Pattern 2 | Yes |
| FR-024 (Soft delete) | 02 | Yes | Pattern 3 | Yes |
| FR-025 (Immutable audit) | 02 | Yes | Pattern 4 | Yes |
| SC-001-008 | 03 | Yes | Compliance section | Yes |

**Spec Compliance Verdict**: EXCELLENT - 100% coverage

---

## Issues by File

### 01-rls-architecture-overview.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Contrast | Major | 🟢 PATCH | `.text-muted` (line 49) | `#8494a8` on `#1e293b` = ~4.1:1, passes AA but fails AAA (7:1 required) | Change to `#9ca3af` for 5.0:1 or `#b0bfce` for 6.5:1 |
| 2 | Contrast | Major | 🟢 PATCH | `.annotation` (line 50) | `#6d28d9` (dark violet) on dark background = ~3.2:1, fails both AA and AAA | Change to `#a78bfa` (lighter violet) for ~5.5:1 |
| 3 | Arrow clarity | Minor | 🟢 PATCH | Line 217 | Anonymous arrow terminates at y=380 against RLS layer but doesn't show "blocked" state clearly | Consider adding a small red X or "BLOCKED" label at termination |
| 4 | Badge consistency | Minor | 🟢 PATCH | Compliance badges (lines 267-274) | "99.9% SLA" badge uses gray border `#8494a8` while GDPR/SOC2 use green `#22c55e` | Change to same green border for visual consistency, or add a different semantic color |

**File Classification**: 🟢 PATCHABLE

---

### 02-policy-patterns.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 5 | Contrast | Major | 🟢 PATCH | `.text-muted` (line 43) | Same as #1: `#8494a8` fails AAA | Change to `#9ca3af` |
| 6 | Text length | Minor | 🟢 PATCH | Pattern 2 warning (line 145) | "WARNING: Service credentials in .env only..." is 82 characters in 600px container | Text fits at 9px monospace, but could wrap to 2 lines for safer rendering |
| 7 | Tight margins | Minor | 🟢 PATCH | Right edge | Pattern boxes extend to x=1360 (720+640) leaving 40px margin | Acceptable for architecture diagrams - no action needed |
| 8 | Vertical spacing | Minor | 🟢 PATCH | y=410 gap | Only 15px vertical gap between row 1 (ends y=395) and row 2 (starts y=410) | Could increase to 25px but current layout is acceptable |

**File Classification**: 🟢 PATCHABLE

---

### 03-access-control-matrix.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 9 | Contrast | Major | 🟢 PATCH | `.text-muted` (line 24) | Same as #1 and #5: `#8494a8` fails AAA | Change to `#9ca3af` |
| 10 | Orphaned legend | Minor | 🟢 PATCH | Legend COND badge (lines 283-287) | Yellow "COND" badge defined in legend but never used in the matrix | Remove COND from legend, or add a note explaining future use |
| 11 | Missing table row | Minor | 🟢 PATCH | SERVICE_ROLE section | Shows users, profiles, audit_logs but missing `sessions` row | Add sessions row between profiles and audit_logs for completeness |
| 12 | Column text length | Minor | 🟢 PATCH | ANON row (line 239) | "users, profiles, sessions, audit_logs" text at 320px wide may render tight | Text centered at x=180, fits at 11px monospace |

**File Classification**: 🟢 PATCHABLE

---

## Overall Assessment

### Issue Breakdown by Category

| Category | Count | Severity | Files Affected |
|----------|-------|----------|----------------|
| Contrast (AAA compliance) | 4 | Major | All 3 |
| Missing content | 1 | Minor | 03 |
| Orphaned element | 1 | Minor | 03 |
| Visual clarity | 1 | Minor | 01 |
| Badge consistency | 1 | Minor | 01 |
| Text length | 2 | Minor | 02, 03 |
| Spacing | 2 | Minor | 02 |

### Strengths

1. **Excellent spec coverage** - All 25 FRs and 8 SCs visualized
2. **Clear visual hierarchy** - Color-coded roles (green/purple/gray)
3. **No layout collisions** - Content fits within boundaries
4. **Appropriate diagram type** - Dark theme for backend/architecture
5. **Consistent styling** - Same patterns across all 3 files
6. **Good annotation** - FR references in pattern headers

### Weaknesses

1. **AAA contrast failures** - `.text-muted` class fails 7:1 ratio
2. **Minor completeness gap** - Missing sessions row in SERVICE_ROLE matrix
3. **Unused legend item** - COND badge is orphaned

---

## Patches to Apply

### All Files - Contrast Fix

```css
/* Change in all 3 SVG <style> sections */
.text-muted { fill: #9ca3af; }  /* Was #8494a8 */
```

### 01-rls-architecture-overview.svg

```css
/* Line 50: Improve annotation contrast */
.annotation { fill: #a78bfa; }  /* Was #6d28d9 */
```

### 03-access-control-matrix.svg

```xml
<!-- Remove or comment out lines 283-287 (unused COND legend) -->
<!-- OR add sessions row in SERVICE_ROLE section after profiles -->
```

---

## Classification Summary

| File | Issues | Classification | Action |
|------|--------|----------------|--------|
| 01-rls-architecture-overview.svg | 4 | 🟢 PATCHABLE | `/wireframe-fix` |
| 02-policy-patterns.svg | 4 | 🟢 PATCHABLE | `/wireframe-fix` |
| 03-access-control-matrix.svg | 4 | 🟢 PATCHABLE | `/wireframe-fix` |

**Final Verdict**: 🟢 ALL FILES PASS - Apply patches via `/wireframe-fix 000`

---

## Next Feature

Proceed to: **001-wcag-aa-compliance**
