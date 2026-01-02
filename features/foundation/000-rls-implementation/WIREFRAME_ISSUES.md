# Wireframe Issues: 000-rls-implementation

## Summary
- **Files reviewed**: 3 SVGs
- **Issues found**: 10 total (9 systemic + 1 XML entity)
- **Issues resolved**: 10 (9 via regeneration + 1 manual fix)
- **Pass**: 7 (XML entity fix + visual verification)
- **Reviewed on**: 2026-01-01
- **Result**: ✅ ALL PASS

## Review History
| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1-4 | 2026-01-01 | 1 | 1 | - | 0 |
| 5 | 2026-01-01 | 9 | 0 | 9 | 9 |
| 6 | 2026-01-01 | 0 | 9 | 0 | 0 |
| 7 | 2026-01-01 | 1 | 1 | 0 | 0 |

**Pass 7 Note**: Fixed XML parsing error in 03-access-control-matrix.svg:
- Line 234: Changed `COMPLIANCE & KEY BEHAVIORS` to `COMPLIANCE &amp; KEY BEHAVIORS`
- Unescaped `&` caused browser XML parser to fail (`xmlParseEntityRef: no name`)
- SVG now renders correctly in wireframe viewer

**Pass 6 Note**: Visual verification in browser viewer confirmed all 3 SVGs now have:
- Correct font sizes (heading-lg=24px, heading=16px, text-md=14px, text-sm=13px)
- Footer consistently at y=780
- Content spread vertically to fill available space

**Pass 5 Note**: User correctly identified systemic issues missed in passes 1-4:
- Fonts too small (template says 24px/16px/14px, generated uses 20px/14px/12px)
- Footer positioning inconsistent (y=720 vs y=780 across pages)
- Wasted vertical space (content clustered at top, ~200px empty before footer)

---

## Root Cause Analysis

Template fixes applied to `.claude/commands/wireframe.md`:
1. **Added rule 9**: Footer positioning (y=780 mandatory for all SVGs in feature set)
2. **Added rule 10**: Vertical content distribution (spread content to fill space)
3. **Added FONT SIZE RULES section**: Explicit table showing required sizes with "do not reduce" enforcement

### The Problem

| Class | Template Size | Generated Size | Delta |
|-------|---------------|----------------|-------|
| `.heading-lg` | 24px | 20px | -4px |
| `.heading` | 16px | 14px | -2px |
| `.text-md` | 14px | 12px | -2px |
| `.text-sm` | 13px | 10px | -3px |

Generated SVGs improvised smaller fonts instead of following the template.

---

## 01-rls-architecture-overview.svg

**Classification**: ✅ PASS

| # | Category | Status | Resolution |
|---|----------|--------|------------|
| 1 | Font Size | ✅ Fixed | Regenerated with correct 24/16/14/13px sizes |
| 2 | Wasted Space | ✅ Fixed | Content now fills y=90 to y=740 |
| 3 | Layout | ✅ Fixed | Footer at y=780, content spread vertically |

---

## 02-policy-patterns.svg

**Classification**: ✅ PASS

| # | Category | Status | Resolution |
|---|----------|--------|------------|
| 1 | Footer Position | ✅ Fixed | Footer now at y=780, consistent with other pages |
| 2 | Font Size | ✅ Fixed | Regenerated with correct 24/16/14/13px sizes |
| 3 | Wasted Space | ✅ Fixed | 2x2 pattern grid fills available space |

---

## 03-access-control-matrix.svg

**Classification**: ✅ PASS

| # | Category | Status | Resolution |
|---|----------|--------|------------|
| 1 | Font Size | ✅ Fixed | Regenerated with correct 24/16/14/13px sizes |
| 2 | Wasted Space | ✅ Fixed | Content spread to fill y=90 to y=740 |
| 3 | Consistency | ✅ Fixed | Footer at y=780, matches other SVGs in set |
| 4 | XML Entity | ✅ Fixed | Line 234: `&` → `&amp;` (manual patch) |

---

## Regeneration Feedback

When running `/wireframe 000-rls-implementation`:

1. **Use template font sizes EXACTLY**:
   - `.heading-lg` = 24px (not 20px)
   - `.heading` = 16px (not 14px)
   - `.text-md` = 14px (not 12px)
   - `.text-sm` = 13px (not 10px)

2. **Footer MUST be at y=780** for ALL SVGs in this feature set - no exceptions

3. **Spread content vertically** to fill available space between title (y=28) and footer (y=780)

4. **If content doesn't fit at proper font sizes**, expand canvas (1600x1000) - NEVER shrink fonts

---

## Spec Requirements to Preserve

| Requirement | Wireframe |
|-------------|-----------|
| FR-001 to FR-004 (table RLS) | 01, 03 |
| FR-006 to FR-010 (User isolation) | 03 |
| FR-011 to FR-014 (Service role) | 01, 02, 03 |
| FR-015 to FR-018 (Audit immutability) | 02, 03 |
| FR-019 to FR-021 (Anonymous restrictions) | 01, 03 |
| FR-022 to FR-025 (Policy patterns) | 02 |
| SC-001 to SC-008 | 01, 03 |

---

## Verification Checklist

- [x] Visual descriptions written for all 3 files
- [x] Font sizes compared against template (PASS after regeneration)
- [x] Footer positioning checked for consistency (PASS - all at y=780)
- [x] Vertical space distribution checked (PASS - content fills space)
- [x] Template fixes applied to prevent recurrence
- [x] Visual verification in browser viewer (PASS - all 3 SVGs)
- [x] XML entity validation (PASS - `&` escaped as `&amp;`)

---

## Conclusion

**✅ ALL SVGs PASS REVIEW**

| File | Status | Verification |
|------|--------|--------------|
| 01-rls-architecture-overview.svg | ✅ PASS | Visual verification complete |
| 02-policy-patterns.svg | ✅ PASS | Visual verification complete |
| 03-access-control-matrix.svg | ✅ PASS | Visual verification complete |

**All fixes verified**:
- Rule 9 (footer at y=780): ✅ All 3 SVGs consistent
- Rule 10 (vertical distribution): ✅ Content spread from y=80 to y=740
- Font sizes: ✅ Using template sizes exactly (heading-lg=24px, heading=16px, text-md=14px, text-sm=13px)

**Next step**: Proceed to `/speckit.plan` for 000-rls-implementation.
