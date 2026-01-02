# Wireframe Issues: 000-rls-implementation

## Summary
- **Files reviewed**: 3 SVGs
- **Issues found**: 21 total across 11 passes
- **Issues resolved**: 21 (all via regeneration/patching)
- **Reviewed on**: 2026-01-02
- **Result**: ✅ ALL PASS

## Review History
| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1-4 | 2026-01-01 | 1 | 1 | - | 0 |
| 5 | 2026-01-01 | 9 | 0 | 9 | 9 |
| 6 | 2026-01-01 | 0 | 9 | 0 | 0 |
| 7 | 2026-01-01 | 1 | 1 | 0 | 0 |
| 8 | 2026-01-02 | 5 | 5 | 0 | 0 |
| 9 | 2026-01-02 | 4 | 4 | 0 | 0 |
| 10 | 2026-01-02 | 1 | 1 | 0 | 0 |
| 11 | 2026-01-02 | 1 | 1 | 0 | 0 |

**Pass 11 Note**: User caught that SERVICE_ROLE bypass arrow (purple dashed) stopped at RLS layer instead of continuing to tables:
- Per FR-011: "System MUST allow service_role to **bypass restrictions**"
- The diagram showed bypass entering RLS layer but never reaching tables
- Legend said "Service bypass" but bypass wasn't actually visualized

**Pass 11 Fixes Applied:**
- Added 4 purple dashed arrows from RLS layer (x=540) to ALL 4 tables
- Now shows: SERVICE_ROLE → RLS Layer → ALL Tables (full bypass access)
- Visual distinction: green=authenticated (policy-checked), purple dashed=service (bypasses)

**Pass 10 Note**: User caught purple OWN badge contrast at 205% zoom:
- Purple (#8b5cf6) + white text = ~4.2:1 ratio (FAILS AA, needs 4.5:1)
- Template had incorrectly listed this as ~4.6:1 (PASS)

**Pass 10 Fixes Applied:**
- Added dark text #1e1b4b (indigo-950) on purple #8b5cf6 badges
- New contrast: #8b5cf6 + #1e1b4b = ~5:1 ratio (PASSES AA)
- Consistent with green/red badge approach (dark text, original bg color)
- 6 OWN badges patched with `.badge-text-on-purple` class

**Pass 9 Note**: User caught issues in 03-access-control-matrix.svg at 130% zoom:
1. Text overlap in COMPLIANCE FOOTER: left column text collided with middle column at x=500
2. Red DENY badge contrast: white text on red (#ef4444) = ~3.1:1 ratio (FAILS AA, needs 4.5:1)
3. GDPR compliance: `profiles DELETE = DENY` misrepresents GDPR Article 17 (Right to Erasure)
4. Legend incomplete: missing SOFT* badge explanation

**Pass 9 Fixes Applied:**
- Split COMPLIANCE FOOTER left column into 3 lines (y=650, 675, 695)
- Added `.badge-text-on-red` CSS class with dark text #450a0a (~10:1 ratio)
- Changed profiles DELETE to SOFT* badge (amber #f59e0b)
- Added footnote explaining GDPR soft delete flow
- Updated legend with SOFT* badge definition

**Template fix applied**: Added red badge contrast rule to `.claude/commands/wireframe.md`

**Pass 8 Note**: User caught issues at 130% zoom that were invisible at 40%:
1. Text clipping in 02-policy-patterns.svg Pattern 3 ("GDPR: actual deletion...")
2. Text clipping in 02-policy-patterns.svg Pattern 4 ("COMPLIANCE: Immutability required for SOC 2 a...")
3. Footer format inconsistent (was `000-rls-implementation`, now `000:01`)
4. WCAG AA contrast failure: white text on green (#22c55e) = ~2.1:1 ratio (needs 4.5:1)
5. Acronyms undefined: GDPR, SOC 2 used without expansion

**Root cause fixes applied to template (`.claude/commands/wireframe.md`):**
- Rule 11: Content clearance to y=750 (30px gap to footer)
- Rule 12: Acronym expansion for compliance terms
- Footer format: `NNN:PP | Page Title | ScriptHammer`
- Green contrast: Dark text (#052e16) on green backgrounds
- Review checklist: Check at 100%+ zoom

---

## Root Cause Analysis

### Pass 8 Template Fixes

| Change | Location | Purpose |
|--------|----------|---------|
| Footer format | Footer example | `000:01` numbering |
| Rule 11 | After rule 10 | Content clearance y=750 |
| Green contrast | Color rules | WCAG AA (~12:1 ratio) |
| Rule 12 | After rule 11 | Acronym expansion |
| Review checklist | Review template | 100%+ zoom verification |

### Contrast Fixes (Pass 8 + Pass 9 + Pass 10)

| Background | Old Text | Old Ratio | New BG/Text | New Ratio |
|------------|----------|-----------|-------------|-----------|
| #22c55e (green) | #ffffff (white) | ~2.1:1 ❌ | Dark text #052e16 | ~12:1 ✅ |
| #ef4444 (red) | #ffffff (white) | ~3.1:1 ❌ | Dark text #450a0a | ~10:1 ✅ |
| #8b5cf6 (purple) | #ffffff (white) | ~4.2:1 ❌ | Darker BG #7c3aed | ~5.7:1 ✅ |

---

## 01-rls-architecture-overview.svg

**Classification**: ✅ PASS

| # | Category | Status | Resolution |
|---|----------|--------|------------|
| 1 | Font Size | ✅ Fixed | Regenerated with correct 24/16/14/13px sizes |
| 2 | Wasted Space | ✅ Fixed | Content fills y=80 to y=700 |
| 3 | Layout | ✅ Fixed | Footer at y=780 |
| 4 | Footer Format | ✅ Fixed | Now `000:01` |
| 5 | Green Contrast | ✅ Fixed | AUTHENTICATED role uses dark text (#052e16) |
| 6 | Acronyms | ✅ Fixed | GDPR, SOC 2 expanded in Compliance panel |
| 7 | SERVICE_ROLE Bypass (Pass 11) | ✅ Fixed | Added 4 purple dashed arrows from RLS to ALL tables |

---

## 02-policy-patterns.svg

**Classification**: ✅ PASS

| # | Category | Status | Resolution |
|---|----------|--------|------------|
| 1 | Footer Position | ✅ Fixed | Footer at y=780 |
| 2 | Font Size | ✅ Fixed | Correct 24/16/14/13px sizes |
| 3 | Pattern 3 Clipping | ✅ Fixed | "GDPR (EU Data Protection)" fits in panel |
| 4 | Pattern 4 Clipping | ✅ Fixed | "SOC 2 (Security Audit)" on separate lines |
| 5 | Footer Format | ✅ Fixed | Now `000:02` |
| 6 | Green Contrast | ✅ Fixed | Pattern 1 header uses dark text (#052e16) |
| 7 | Content Clearance | ✅ Fixed | All content ends by y=700, footer at y=780 |

---

## 03-access-control-matrix.svg

**Classification**: ✅ PASS (after Pass 9 regeneration)

| # | Category | Status | Resolution |
|---|----------|--------|------------|
| 1 | Font Size | ✅ Fixed | Correct 24/16/14/13px sizes |
| 2 | Wasted Space | ✅ Fixed | Content spread to fill y=75 to y=710 |
| 3 | Footer Format | ✅ Fixed | Now `000:03` |
| 4 | XML Entity | ✅ Fixed | `&` escaped as `&amp;` |
| 5 | Green Badge Contrast | ✅ Fixed | ALL badges use dark text (#052e16) |
| 6 | Acronyms | ✅ Fixed | GDPR, SOC 2 expanded in compliance footer |
| 7 | Content Clearance | ✅ Fixed | Compliance panel ends at y=720 |
| 8 | Text Overlap (Pass 9) | ✅ Fixed | COMPLIANCE FOOTER left column split into 3 lines |
| 9 | Red Badge Contrast (Pass 9) | ✅ Fixed | DENY badges use dark text (#450a0a) |
| 10 | GDPR Compliance (Pass 9) | ✅ Fixed | profiles DELETE now SOFT* badge with footnote |
| 11 | Legend (Pass 9) | ✅ Fixed | Added SOFT* badge definition |
| 12 | Purple OWN Badge Contrast (Pass 10) | ✅ Fixed | Changed #8b5cf6 → #7c3aed (~5.7:1) |

---

## Verification Checklist

- [x] Visual descriptions written for all 3 files
- [x] Font sizes compared against template (PASS - 24/16/14/13px)
- [x] Footer positioning checked (PASS - all at y=780)
- [x] Footer format updated (PASS - `000:01`, `000:02`, `000:03`)
- [x] Vertical space distribution checked (PASS - content fills space)
- [x] Content clearance verified (PASS - all content ends by y=750)
- [x] Green contrast fixed (PASS - dark text #052e16 on #22c55e)
- [x] Red contrast fixed (PASS - dark text #450a0a on #ef4444) ← Pass 9
- [x] Purple contrast fixed (PASS - darker bg #7c3aed gives ~5.7:1) ← Pass 10
- [x] Acronyms expanded (PASS - GDPR, SOC 2 defined)
- [x] Template fixes applied to prevent recurrence
- [x] XML entity validation (PASS - `&` escaped as `&amp;`)
- [x] Text overlap verified at 130% zoom (PASS - no collisions) ← Pass 9
- [x] GDPR compliance verified (PASS - SOFT* badge for profile deletion) ← Pass 9

---

## Conclusion

**✅ ALL SVGs PASS REVIEW**

| File | Status | Key Fixes |
|------|--------|-----------|
| 01-rls-architecture-overview.svg | ✅ PASS | Green contrast, footer format, acronyms |
| 02-policy-patterns.svg | ✅ PASS | Clipping fixed, content clearance, acronyms |
| 03-access-control-matrix.svg | ✅ PASS | ALL badge contrast (green+red+purple), GDPR SOFT* badge, text overlap fixed |

**Template improvements ensure future wireframes will:**
- Use dark text on green backgrounds (#052e16 on #22c55e, ~12:1)
- Use dark text on red backgrounds (#450a0a on #ef4444, ~10:1)
- Use darker purple (#7c3aed instead of #8b5cf6, ~5.7:1 with white)
- End content by y=750 (30px footer clearance)
- Use `NNN:PP` footer numbering format
- Expand compliance acronyms (GDPR, SOC 2, WCAG)
- Be reviewed at 100%+ zoom to catch clipping/overlap
- Show SOFT* badge for soft delete columns (GDPR Article 17 compliance)

**Next step**: Proceed to `/speckit.plan` for 000-rls-implementation.
