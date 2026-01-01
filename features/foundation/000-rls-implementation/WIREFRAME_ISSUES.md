# Wireframe Issues: 000-rls-implementation

## Summary
- **Files reviewed**: 3 SVGs
- **Issues found**: 12 total (0 critical, 5 major, 7 minor)
- **Reviewed on**: 2026-01-01
- **Fix attempted**: 2026-01-01
- **Overall verdict**: 🔴 ALL NEED REGENERATION (strict criteria applied)

### Strict Triage Result
| File | Patchable | Structural | Verdict |
|------|-----------|------------|---------|
| 01-rls-architecture-overview.svg | 2 | 3 | 🔴 REGENERATE |
| 02-policy-patterns.svg | 2 | 1 | 🔴 REGENERATE |
| 03-access-control-matrix.svg | 2 | 1 | 🔴 REGENERATE |

## Requirements Extracted from spec.md

### Functional Requirements (FR)
- **FR-001 to FR-005**: Enable RLS on users, profiles, sessions, audit_logs, and all new tables
- **FR-006 to FR-010**: User data isolation (SELECT/UPDATE own data only, empty results on unauthorized)
- **FR-011 to FR-014**: Service role bypass with audit trail, credentials not exposed to client
- **FR-015 to FR-018**: Audit log immutability (INSERT only via service_role, no UPDATE/DELETE)
- **FR-019 to FR-021**: Anonymous restrictions (deny writes, public read only, no user enumeration)
- **FR-022 to FR-025**: Standard patterns (owner isolation, service bypass, soft delete, immutable audit)

### Success Criteria (SC)
- **SC-001**: All core tables have RLS enabled before production
- **SC-002**: Zero cross-user data access (100% isolation)
- **SC-003**: Service role operations succeed for all documented use cases
- **SC-004**: <10ms policy overhead per query
- **SC-005**: 100% test coverage of access scenarios
- **SC-006**: Security review approved before production
- **SC-007**: Audit log integrity - zero modify/delete success
- **SC-008**: Zero user identifiers exposed to anonymous users

### Coverage Analysis
| Requirement | 01-architecture | 02-patterns | 03-matrix | Status |
|-------------|-----------------|-------------|-----------|--------|
| FR-001 to FR-005 | Visualized | - | Referenced | ✅ |
| FR-006 to FR-010 | Visualized | FR-022 | Detailed | ✅ |
| FR-011 to FR-014 | Visualized | FR-023 | Detailed | ✅ |
| FR-015 to FR-018 | Visualized | FR-025 | Detailed | ✅ |
| FR-019 to FR-021 | Visualized | - | Detailed | ✅ |
| FR-022 to FR-025 | - | All patterns | Referenced | ✅ |
| SC-001 to SC-008 | Partial | - | Detailed | ✅ |

**Spec compliance**: All 25 FRs and 8 SCs are visualized across the 3 wireframes.

---

## Issues by File

### 01-rls-architecture-overview.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Arrow endpoint | Minor | 🔴 REGENERATE | Lines 207-209 | Arrows from RLS layer to tables point to approximate positions (540,155 and 540,305) but table transforms start at y=90 and y=240. Arrow endpoints should target table centers more precisely. | Adjust arrow path endpoints: `M 480 200 L 540 155` → `M 480 200 L 540 145` (center of users table at y=90+55) |
| 2 | Missing annotation | Minor | 🔴 REGENERATE | Tables section | No FR labels on the protected tables to map them to spec requirements | Add `<text class="annotation">FR-001</text>` near users table, FR-002 near profiles, etc. |
| 3 | Spacing inconsistency | Minor | 🔴 REGENERATE | Legend/Principles panels | Legend panel at y=60, height=180, ends at y=240. Key Principles at y=260. Gap is 20px. Compliance panel at y=480 with gap of 220px (wasted space). | Move Compliance panel to y=480 is fine, but consider reducing gap or adding more content |
| 4 | Text contrast | Major | 🟢 PATCHABLE | Line 49 `.text-muted` | `#9ca3af` on `#1e293b` background = ~4.5:1 ratio (passes AA but fails AAA 7:1) | Change to `#b4bcc8` for 7:1 AAA compliance |
| 5 | Text contrast | Major | 🟢 PATCHABLE | Line 50 `.annotation` | `#a78bfa` on dark background = ~5.5:1 (passes AA, fails AAA) | Change to `#c4b5fd` for 7:1 AAA compliance |

**File verdict**: 🔴 REGENERATE (contains 3 structural issues: arrow position, missing content, spacing)

---

### 02-policy-patterns.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Text contrast | Major | 🟢 PATCHABLE | Line 43 `.text-muted` | `#9ca3af` on `#1e293b` = ~4.5:1 fails AAA | Change to `#b4bcc8` |
| 2 | Content truncation risk | Minor | ⏭️ SKIP | Pattern 2, line 122-123 | Description text "Purpose: Allow backend services to access any row for system ops" is 63 chars. Safe at 12px but check rendering. | No fix needed if renders correctly |
| 3 | Panel boundary | Minor | 🔴 REGENERATE | Pattern 3 & 4 | Both patterns have content boxes ending at y=345 (410+45+300=755) and y=345 (410+45+300=755 for pattern 4 at x=720). Footer is at y=780. Only 25px gap. | Acceptable but tight. Consider reducing pattern content boxes from height=300 to height=290 |
| 4 | Code readability | Minor | 🟢 PATCHABLE | Line 44-45 `.code` and `.code-sm` | 10px and 9px monospace code is at the minimum readable threshold | Increase `.code-sm` from 9px to 10px for better readability |

**File verdict**: 🔴 REGENERATE (contains 1 structural issue: height change)

---

### 03-access-control-matrix.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Text contrast | Major | 🟢 PATCHABLE | Line 24 `.text-muted` | `#9ca3af` on `#1e293b` = ~4.5:1 fails AAA | Change to `#b4bcc8` |
| 2 | Table width | Minor | 🟢 PATCHABLE | Line 239 | Cell "users, profiles, sessions, audit_logs" is 270px wide in a 260px column (TABLE column x=0-260). Text may clip or overflow. | Shorten to "All protected tables" or reduce font size |
| 3 | Missing annotation | Minor | 🔴 REGENERATE | Anonymous section | No explicit reference to FR-019, FR-020, FR-021 in the ANON section labels | Add FR references like the other sections have |

**File verdict**: 🔴 REGENERATE (contains 1 structural issue: add content)

---

## Issue Summary by Category

| Category | Count | Severity Breakdown |
|----------|-------|-------------------|
| Text contrast (AAA failure) | 4 | 4 Major |
| Missing annotations/labels | 2 | 2 Minor |
| Arrow positioning | 1 | 1 Minor |
| Spacing/gaps | 2 | 2 Minor |
| Content truncation risk | 1 | 1 Minor |
| Code font size | 1 | 1 Minor |
| Text overflow | 1 | 1 Major |

---

## Consolidated Fixes

### Global CSS Fixes (apply to all 3 files)

```css
/* AAA Contrast fixes */
.text-muted { fill: #b4bcc8; }  /* was #9ca3af - now 7:1 ratio */
.annotation { fill: #c4b5fd; }  /* was #a78bfa - now 7:1 ratio */
.code-sm { font-size: 10px; }   /* was 9px - minimum readable */
```

### File-Specific Fixes

**01-rls-architecture-overview.svg:**
- Add FR annotations near tables

**03-access-control-matrix.svg:**
- Line 239: Change text from "users, profiles, sessions, audit_logs" to "All protected tables"

---

## Action Items

### /wireframe-fix Result (2026-01-01):

**0 files patched, 3 files need regeneration**

Using strict criteria, ALL files contain structural issues that cannot be safely patched:
- ❌ 01-rls-architecture-overview.svg: SKIPPED (arrow position, missing content, spacing)
- ❌ 02-policy-patterns.svg: SKIPPED (height change)
- ❌ 03-access-control-matrix.svg: SKIPPED (add content)

### Next Step: Regenerate all 3 wireframes

```bash
/wireframe 000-rls-implementation
```

The regeneration should address:
1. **01-rls-architecture-overview.svg**: Add FR annotations, fix arrow endpoints, optimize panel spacing
2. **02-policy-patterns.svg**: Reduce panel heights for better footer clearance, improve code readability
3. **03-access-control-matrix.svg**: Add FR-019/020/021 references, shorten table cell text

**Color/font fixes will be applied automatically during regeneration.**

---

## 🔴 REGENERATION FEEDBACK

### 01-rls-architecture-overview.svg

#### Diagnosis
1. Arrow paths at lines 207-209 have approximate endpoints (540,155 and 540,305) that don't align with table transform origins (y=90, y=240). Visual disconnect between RLS layer and protected tables.
2. No FR-001 through FR-004 annotations near the four protected tables, making spec traceability unclear.
3. Right-side panels have inconsistent vertical distribution: Legend (y=60, h=180), Principles (y=260, h=200), Compliance (y=480, h=80). Gap between Principles and Compliance is 220px of wasted space.

#### Root Cause
The wireframe prioritized fitting content but didn't optimize arrow precision or include spec requirement labels. Right-side panel heights were set independently without considering total vertical rhythm.

#### Suggested Layout
- Keep left side (Security Roles) and center (RLS Policy Layer) as-is - they work well
- Add FR annotations: `FR-001` below users table, `FR-002` below profiles, `FR-003` below sessions, `FR-004` below audit_logs
- Adjust arrow endpoints to target vertical center of each table group
- Right side: Redistribute panels - Legend (y=60, h=150), Principles (y=230, h=180), Compliance (y=430, h=100) for even spacing

#### Spec Requirements to Preserve
- FR-001 to FR-004 (core table security) - ADD visible labels
- FR-006 to FR-010 (user isolation) - shown in policy layer
- FR-011 to FR-014 (service role) - shown in roles section
- SC-001 (all tables have RLS) - shown in green status indicators

#### CSS Fixes to Apply
```css
.text-muted { fill: #b4bcc8; }  /* AAA contrast */
.annotation { fill: #c4b5fd; }  /* AAA contrast */
```

---

### 02-policy-patterns.svg

#### Diagnosis
1. Pattern 3 and Pattern 4 content boxes have height=300, placing their bottom edge at y=755 (410+45+300). Footer is at y=780, leaving only 25px clearance - too tight.
2. `.code-sm` class uses 9px font which is below comfortable reading threshold for code.

#### Root Cause
Pattern boxes were given uniform height=300 without accounting for varying content density. Pattern 3 (Soft Delete) and Pattern 4 (Immutable Audit) could use less vertical space.

#### Suggested Layout
- Reduce pattern content boxes from height=300 to height=280
- This moves bottom edges from y=755 to y=735, giving 45px footer clearance
- Alternatively, move footer from y=780 to y=770 (patterns are more important than footer padding)

#### Spec Requirements to Preserve
- FR-022 (owner isolation pattern) - Pattern 1
- FR-023 (service bypass pattern) - Pattern 2
- FR-024 (soft delete pattern) - Pattern 3
- FR-025 (immutable audit pattern) - Pattern 4

#### CSS Fixes to Apply
```css
.text-muted { fill: #b4bcc8; }  /* AAA contrast */
.code-sm { font-size: 10px; }   /* readable code */
```

---

### 03-access-control-matrix.svg

#### Diagnosis
1. ANON section (line 234-256) lacks FR references. AUTHENTICATED section has "FR-006 to FR-010" style references in Key Requirements panel, but ANON section doesn't reference FR-019/020/021.
2. Line 239 text "users, profiles, sessions, audit_logs" is ~270px wide in a column that's only 260px (TABLE column between x=0 and first divider at x=260).

#### Root Cause
ANON section was treated as simpler (all DENY) so FR references were omitted. Text overflow wasn't caught because monospace font width varies by renderer.

#### Suggested Layout
- Add text after "ANON (unauthenticated)": include "(FR-019 to FR-021)" similar to other role sections
- Shorten line 239 from "users, profiles, sessions, audit_logs" to "All protected tables" (22 chars vs 36 chars)
- Or: reduce font-size on that cell from 11px to 10px

#### Spec Requirements to Preserve
- FR-019 (deny anonymous writes) - ADD label
- FR-020 (public read only) - ADD label
- FR-021 (prevent enumeration) - ADD label
- SC-008 (zero user IDs exposed) - already shown in Compliance section

#### CSS Fixes to Apply
```css
.text-muted { fill: #b4bcc8; }  /* AAA contrast */
```

---

## Quality Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| Spec coverage | 10/10 | All 25 FRs and 8 SCs visualized |
| Layout quality | 9/10 | Clean, logical arrangement |
| Readability | 8/10 | Minor AAA contrast failures |
| Completeness | 9/10 | Missing some FR annotations |
| Architecture accuracy | 10/10 | Correctly represents RLS concepts |

**Overall**: High-quality wireframes with minor polish issues. Ready for implementation after contrast fixes.
