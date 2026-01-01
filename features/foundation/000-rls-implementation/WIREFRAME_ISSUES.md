# Wireframe Issues: 000-rls-implementation

## Summary
- **Files reviewed**: 3 SVGs
- **Pass**: 4
- **Reviewed on**: 2026-01-01
- **Issues from Pass 3**: 0 (all regenerated)
- **Verified this pass**: 16 fixes confirmed
- **NEW issues found**: 0
- **Total remaining**: 0
- **Overall verdict**: ✅ ALL ISSUES RESOLVED - READY FOR IMPLEMENTATION

## Review History

| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1 | 2026-01-01 | 12 | - | 12 | 12 |
| 2 | 2026-01-01 | 16 | 0 | 4 | 16 |
| 3 | 2026-01-01 | 0 | 16 | 0 | 0 |
| 4 | 2026-01-01 | 0 | - | 0 | 0 |

## Final Status

| File | Action | Pass 4 Verification |
|------|--------|---------------------|
| 01-rls-architecture-overview.svg | 🔄 REGENERATED | ✅ PASS - All 6 issues resolved |
| 02-policy-patterns.svg | 🔄 REGENERATED | ✅ PASS - All 4 issues resolved |
| 03-access-control-matrix.svg | 🔄 REGENERATED | ✅ PASS - All 6 issues resolved |

### Fixes Applied in Regeneration

**01-rls-architecture-overview.svg**:
- ✅ Added FR-001 to FR-004 labels on protected tables
- ✅ Improved arrow endpoints targeting table centers
- ✅ Redistributed right-side panels (Legend y=60, Principles y=250, Compliance y=470)
- ✅ Fixed `.text-muted` contrast to `#b4bcc8` (AAA compliant)
- ✅ Fixed `.annotation` contrast to `#c4b5fd` (AAA compliant)
- ✅ Added FR references to Key Principles section

**02-policy-patterns.svg**:
- ✅ Reduced pattern box heights from 300 to 280
- ✅ Moved footer from y=780 to y=720 (80px gap)
- ✅ Fixed `.text-muted` contrast to `#b4bcc8` (AAA compliant)
- ✅ Fixed `.code-sm` font size to 10px (readable)

**03-access-control-matrix.svg**:
- ✅ Added missing sessions row in SERVICE_ROLE section
- ✅ Added FR-006 to FR-010 reference in AUTHENTICATED header
- ✅ Added FR-011 to FR-014 reference in SERVICE_ROLE header
- ✅ Added FR-019 to FR-021 reference in ANON header
- ✅ Shortened ANON table text to "All protected tables"
- ✅ Fixed `.text-muted` contrast to `#b4bcc8` (AAA compliant)
- ✅ Added consistent styling for FR-019-021 in Key Requirements
- ✅ Increased table height to accommodate sessions row

---

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

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Arrow endpoint | Minor | 🔴 REGENERATE | Pass 1 | Lines 207-209 | Arrows from RLS layer to tables point to approximate positions (540,155 and 540,305) but table transforms start at y=90 and y=240. Arrow endpoints should target table centers more precisely. | Adjust arrow path endpoints to target vertical center of each table group |
| 2 | Missing annotation | Minor | 🔴 REGENERATE | Pass 1 | Tables section | No FR labels (FR-001 to FR-004) on the protected tables to map them to spec requirements | Add `<text class="annotation">FR-001</text>` near users table, FR-002 near profiles, etc. |
| 3 | Spacing inconsistency | Minor | 🔴 REGENERATE | Pass 1 | Right-side panels | Legend (y=60, h=180), Principles (y=260), Compliance (y=480, h=80). Gap between Principles end (y=460) and Compliance is 20px, but 220px wasted space below Compliance to footer. | Redistribute panels: Legend (y=60, h=150), Principles (y=230, h=180), Compliance (y=430, h=100) |
| 4 | Text contrast | Major | 🟢 PATCHABLE | Pass 1 | Line 49 `.text-muted` | `#9ca3af` on `#1e293b` background = ~4.5:1 ratio (passes AA but fails AAA 7:1) | Change to `#b4bcc8` for 7:1 AAA compliance |
| 5 | Text contrast | Major | 🟢 PATCHABLE | Pass 1 | Line 50 `.annotation` | `#a78bfa` on dark background = ~5.5:1 (passes AA, fails AAA) | Change to `#c4b5fd` for 7:1 AAA compliance |
| 6 | Arrow endpoint | Minor | 🔴 REGENERATE | NEW Pass 2 | Lines 213-214 | Service role arrows bypass RLS layer visually, targeting `740,155` and `740,305` - should target actual table centers at profiles (transform y=90, center ~y=155) and audit_logs (transform y=240, center ~y=305). Off by small margin but imprecise. | Calculate exact table center coordinates: profiles center at 740+(180/2)=830, y=90+(130/2)=155 |

**File verdict**: 🔴 REGENERATE (contains 4 structural issues)

---

### 02-policy-patterns.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Text contrast | Major | 🟢 PATCHABLE | Pass 1 | Line 43 `.text-muted` | `#9ca3af` on `#1e293b` = ~4.5:1 fails AAA | Change to `#b4bcc8` |
| 2 | Panel boundary | Minor | 🔴 REGENERATE | Pass 1 | Patterns 3 & 4 | Content boxes end at y=755 (transform 410 + header 40 + content 300 + padding 5). Footer at y=780. Only 25px gap - too tight for visual breathing room. | Reduce content box height from 300 to 280, or move footer to y=770 |
| 3 | Code readability | Minor | 🟢 PATCHABLE | Pass 1 | Line 45 `.code-sm` | 9px monospace code is at the minimum readable threshold | Increase `.code-sm` from 9px to 10px for better readability |
| 4 | Content density | Minor | 🔴 REGENERATE | NEW Pass 2 | All pattern boxes | All 4 patterns use identical height=300 regardless of content density. Pattern 2 (Service Bypass) has less code (lines 125-132 = 7 lines) than Pattern 1 (lines 83-92 = 10 lines) but gets same space. Wastes vertical space in shorter patterns. | Adjust box heights based on content: Pattern 1 (280), Pattern 2 (260), Pattern 3 (280), Pattern 4 (280) |

**File verdict**: 🔴 REGENERATE (contains 2 structural issues)

---

### 03-access-control-matrix.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Text contrast | Major | 🟢 PATCHABLE | Pass 1 | Line 24 `.text-muted` | `#9ca3af` on `#1e293b` = ~4.5:1 fails AAA | Change to `#b4bcc8` |
| 2 | Text overflow | Minor | 🟢 PATCHABLE | Pass 1 | Line 239 | Cell "users, profiles, sessions, audit_logs" is ~270px wide (36 chars × 7.5px avg monospace) in TABLE column that's ~260px wide. May clip or overflow. | Shorten to "All protected tables" (22 chars) or reduce font-size to 10px |
| 3 | Missing annotation | Minor | 🔴 REGENERATE | Pass 1 | Anonymous section header | Line 235: ANON section has no explicit FR-019, FR-020, FR-021 references in header, unlike other sections. | Add "(FR-019 to FR-021)" after "ANON (unauthenticated)" |
| 4 | Contrast inconsistency | Minor | 🟢 PATCHABLE | NEW Pass 2 | Line 235 | ANON section header uses `fill="#94a3b8"` (muted gray) while other section headers use role-specific colors (green for AUTH, purple for SERVICE). Inconsistent visual hierarchy. | Change to `fill="#64748b"` or keep gray but increase brightness to `#b4bcc8` |
| 5 | Color inconsistency | Minor | 🔴 REGENERATE | NEW Pass 2 | Line 300 | FR-019 to FR-021 in Key Requirements panel uses `fill="#94a3b8"` (muted) while other FR references (lines 291, 294, 297) use colored fills. Anonymous restrictions visually deprioritized. | Use consistent styling - either all colored or all muted, but FR-019-021 should have same visual weight |
| 6 | Missing sessions row | Minor | 🔴 REGENERATE | NEW Pass 2 | SERVICE_ROLE section | SERVICE_ROLE section (lines 164-231) shows rows for users, profiles, and audit_logs but missing sessions row. Should have 4 tables like AUTHENTICATED section. | Add sessions row between profiles (line 209) and audit_logs (line 211) with ALL/ALL/ALL/ALL access |

**File verdict**: 🔴 REGENERATE (contains 3 structural issues)

---

## Issue Summary by Category

| Category | Count | Severity Breakdown |
|----------|-------|-------------------|
| Text contrast (AAA failure) | 4 | 4 Major |
| Missing annotations/labels | 3 | 3 Minor |
| Arrow positioning | 2 | 2 Minor |
| Spacing/gaps | 2 | 2 Minor |
| Content density | 1 | 1 Minor |
| Color/style inconsistency | 2 | 2 Minor |
| Missing table row | 1 | 1 Minor |
| Text overflow | 1 | 1 Minor |

**Total: 16 issues (4 Major, 12 Minor)**

---

## Consolidated Fixes

### Global CSS Fixes (apply to all 3 files during regeneration)

```css
/* AAA Contrast fixes */
.text-muted { fill: #b4bcc8; }  /* was #9ca3af - now 7:1 ratio */
.annotation { fill: #c4b5fd; }  /* was #a78bfa - now 7:1 ratio */
.code-sm { font-size: 10px; }   /* was 9px - minimum readable */
```

---

## 🔴 REGENERATION FEEDBACK

### 01-rls-architecture-overview.svg

#### Diagnosis
1. Arrow paths at lines 207-209, 213-214 have approximate endpoints that don't precisely target table vertical centers. Visual disconnect between arrows and targets.
2. No FR-001 through FR-004 annotations near the four protected tables, making spec traceability unclear.
3. Right-side panels have inconsistent vertical distribution: Legend (y=60, h=180), Principles (y=260, h=200), Compliance (y=480, h=80). Gap between Principles end and Compliance is 20px, but 220px wasted space below Compliance to footer (y=780).

#### Root Cause
The wireframe prioritized fitting content but didn't optimize arrow precision or include spec requirement labels. Right-side panel heights were set independently without considering total vertical rhythm.

#### Suggested Layout
- Keep left side (Security Roles) and center (RLS Policy Layer) as-is - they work well
- Add FR annotations: `FR-001` below users table, `FR-002` below profiles, `FR-003` below sessions, `FR-004` below audit_logs (stacked vertically in small text)
- Calculate precise arrow endpoints: target vertical center of each table group (y + height/2)
- Right side: Redistribute panels evenly across available 720px (y=60 to y=780):
  - Legend (y=60, h=170)
  - Principles (y=250, h=200)
  - Compliance (y=470, h=120)
  - Leaves 40px padding to footer

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
2. All 4 patterns use identical height=300 regardless of content density. Pattern 2 has less content than others.
3. `.code-sm` class uses 9px font which is below comfortable reading threshold for code.

#### Root Cause
Pattern boxes were given uniform height=300 without accounting for varying content density. The 2x2 grid layout prioritized symmetry over content-aware sizing.

#### Suggested Layout
- Row 1 (y=50): Pattern 1 (height=280) and Pattern 2 (height=280) - both fit comfortably
- Row 2 (y=380): Pattern 3 (height=280) and Pattern 4 (height=280)
- This gives bottom edge at y=380+40+280=700, with 80px to footer at y=780
- Alternative: Keep current layout but reduce all heights to 280 uniformly

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
1. ANON section header (line 235) lacks FR references unlike other sections. Also uses muted `#94a3b8` color instead of role-appropriate styling.
2. Line 239 text "users, profiles, sessions, audit_logs" may overflow the TABLE column (~260px wide).
3. FR-019 to FR-021 in Key Requirements panel (line 300) uses muted styling while other FRs are colored - inconsistent visual hierarchy.
4. SERVICE_ROLE section is missing a sessions table row - only shows users, profiles, and audit_logs but should show all 4 protected tables.

#### Root Cause
ANON section was treated as simpler (all DENY) so FR references and proper styling were omitted. The sessions row omission in SERVICE_ROLE section appears to be an oversight. Text overflow wasn't caught because monospace font width varies by renderer.

#### Suggested Layout
- ANON section header: Change to "ANON (unauthenticated) - FR-019 to FR-021"
- Line 239: Shorten from "users, profiles, sessions, audit_logs" to "All protected tables"
- Add sessions row in SERVICE_ROLE section between profiles and audit_logs
- Key Requirements panel: Use consistent color for all FR references (either all colored or all using the same muted style)

#### Spec Requirements to Preserve
- FR-019 (deny anonymous writes) - ADD visible label in header
- FR-020 (public read only) - ADD visible label
- FR-021 (prevent enumeration) - ADD visible label
- SC-008 (zero user IDs exposed) - already shown in Compliance section
- All 4 tables should appear in each role section

#### CSS Fixes to Apply
```css
.text-muted { fill: #b4bcc8; }  /* AAA contrast */
```

---

## Action Items

### Current State (Pass 2 Complete)

**0 files patched, 3 files need regeneration**

All files contain structural issues that cannot be safely patched:
- ❌ 01-rls-architecture-overview.svg: 4 structural issues (arrows, missing content, spacing)
- ❌ 02-policy-patterns.svg: 2 structural issues (panel heights, content density)
- ❌ 03-access-control-matrix.svg: 3 structural issues (missing row, missing annotations, inconsistent styling)

### Next Step

```bash
/wireframe 000-rls-implementation
```

The regeneration should incorporate ALL feedback from this review to produce wireframes with:
1. Precise arrow targeting
2. FR annotation labels on all protected tables
3. Optimized panel spacing
4. AAA contrast compliance
5. Complete table coverage in all role sections
6. Consistent visual styling across sections

---

## Quality Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| Spec coverage | 9/10 | All FRs/SCs visualized, missing sessions in SERVICE section |
| Layout quality | 7/10 | Good structure but spacing/sizing issues |
| Readability | 7/10 | AAA contrast failures, 9px code font |
| Completeness | 8/10 | Missing FR annotations, missing table row |
| Architecture accuracy | 10/10 | Correctly represents RLS concepts |

**Overall**: Good wireframes with polish issues. Ready for implementation after regeneration addresses identified issues.
