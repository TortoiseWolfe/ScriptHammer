---
description: Critically review SVG wireframes with ruthless attention to detail. Find EVERY flaw.
---

## User Input

```text
$ARGUMENTS
```

---

## Step 0: Check for Previous Review (Iterative Mode)

**Before starting the review, check if this is a subsequent pass.**

Look for existing `WIREFRAME_ISSUES.md` in the feature directory:
```
features/[category]/[feature-folder]/WIREFRAME_ISSUES.md
```

### If NO existing file:
- This is **Pass 1** (fresh review)
- Proceed with full review
- Create new WIREFRAME_ISSUES.md

### If existing file found:
- Read the file and extract:
  - **Current pass number** (from Review History table)
  - **Previous issues** (all rows from issue tables)
  - **Issue fingerprints** (Category + Location + Description hash for matching)
- Increment pass number
- Proceed with **FULL review of ALL files** (don't skip any - might catch overlooked issues)
- After review, compare findings against previous pass

### Comparison Logic (after full review):

For each issue found in current pass:
1. **Check if it matches a previous issue** (same category, location, description)
   - If match found and issue still exists → Status: `Pass N` (where N = when first found)
   - If match found but issue resolved → Status: `✅ RESOLVED`
2. **If no match** → Status: `NEW Pass N` (current pass number)

For each previous issue NOT found in current pass:
- Mark as `✅ RESOLVED` (the fix worked!)

### Pass Completion Summary:

```
Pass 2 Complete:
- Issues from Pass 1: 12
- Resolved this pass: 6
- Still remaining: 4
- NEW issues found: 2
- Total remaining: 6

Next: /wireframe [feature] to fix remaining issues
```

### All Issues Resolved?

If remaining issues = 0:
```
🎉 All wireframe issues resolved!

Review History:
- Pass 1: 12 issues found
- Pass 2: 6 resolved, 2 new
- Pass 3: 8 resolved, 0 new

Wireframes are ready. Proceed to:
  /speckit.plan [feature]
```

---

## Critical Review Philosophy

**DO NOT give participation trophies.** These wireframes need to be BEST-IN-CLASS. Every pixel matters.

Your job is to find problems, not praise. Assume every wireframe has issues until proven otherwise. Be the harshest critic. If something looks "fine," look harder - there's always room for improvement.

The goal is not to validate - it's to CHALLENGE these wireframes to be better.

---

## Issue Categories - SCRUTINIZE EACH ONE

### 1. OVERLAP & COLLISION ISSUES (Look at EVERY row/section boundary)

- **Row collisions** - Does Row 1 content bleed into Row 2? Are sections fighting for the same space?
- **Label collisions** - Do annotation labels overlap with content?
- **Panel boundary violations** - Does content extend beyond its containing panel?
- **Mobile/Desktop overlap** - Does the mobile preview area collide with desktop content?
- **Z-index conflicts** - Are elements stacking incorrectly?

### 2. CLIPPING & TRUNCATION (Check EVERY text element)

- **Text cut-off** - Is ANY text being clipped by its container?
- **Button label truncation** - Do button labels fit or get cut?
- **Long content handling** - What happens with longer strings?
- **Icon clipping** - Are icons fully visible?
- **Panel edge clipping** - Does content get too close to panel edges?

### 3. SPACING & DENSITY ISSUES (Measure with your eyes)

- **Cramped areas** - Where are things squeezed together that shouldn't be?
- **Wasted space** - Where is there empty space that could be used better?
- **Inconsistent margins** - Are margins consistent between similar elements?
- **Inconsistent padding** - Is padding uniform within containers?
- **Gutter problems** - Are gaps between columns/rows consistent?
- **Touch target spacing** - Is there 8px minimum between tappable elements?

### 4. SIZE & PROPORTION ISSUES (Question every element's size)

- **Too small to read** - Is any text below 10px? Can annotations be read?
- **Too large/dominant** - Does any element visually overpower its importance?
- **Inconsistent sizing** - Are similar elements sized differently?
- **Aspect ratio issues** - Do avatars, icons maintain proper ratios?
- **Phone frame proportions** - Is the mobile frame realistically sized?

### 5. ALIGNMENT ISSUES (Check EVERY horizontal and vertical line)

- **Horizontal misalignment** - Are elements that should align horizontally actually aligned?
- **Vertical misalignment** - Are elements in columns properly aligned?
- **Baseline alignment** - Is text baseline-aligned where appropriate?
- **Center alignment** - Are "centered" elements actually centered?
- **Grid violations** - Does the layout follow a consistent grid?

### 6. CONTRAST & ACCESSIBILITY (WCAG AAA = 7:1 ratio minimum)

For AAA compliance, check these color combinations:
- **Light theme text** - Is `#4a5568` on `#e8d4b8` achieving 7:1? (Hint: it's not)
- **Dark theme muted text** - Is `#94a3b8` on `#1e293b` readable?
- **Annotation text** - Is `#8b5cf6` visible against both themes?
- **Button text contrast** - White text on `#8b5cf6` - sufficient?
- **Status indicators** - Are green/red status colors distinguishable without color?

### 7. LAYOUT EFFICIENCY (Challenge the arrangement)

- **Could rows be rearranged?** - Would swapping sections reduce overlap?
- **Better use of whitespace?** - Could content spread into empty areas?
- **Horizontal vs vertical** - Should side-by-side elements stack instead?
- **Panel sizing** - Are panels appropriately sized for their content?
- **Information density** - Too sparse? Too dense?

### 8. ARCHITECTURE DIAGRAM SPECIFIC

- **Arrow endpoints** - Do ALL arrows connect to their targets?
- **Arrow occlusion** - Are arrows hidden behind elements?
- **Flow direction clarity** - Is the flow direction obvious?
- **Label positioning** - Are labels close to what they describe?
- **Connector gaps** - Are there suspicious gaps in connection lines?

### 9. TOUCH TARGET COMPLIANCE (WCAG AAA = 44×44px minimum) ⚠️ CRITICAL

**This applies to BOTH desktop AND mobile. Check EVERY interactive element.**

For EACH of these element types, verify height ≥ 44px:
- **Buttons** (primary, secondary, icon) - Check `height` attribute
- **Input fields** (text, email, password, search) - Check `height` attribute
- **Navigation items** (sidebar links, tab items) - Check `height` attribute
- **List items** (if tappable/clickable) - Check `height` attribute
- **OAuth buttons** - Check `height` attribute
- **Form controls** (checkboxes, radios, toggles) - Check tap target area
- **Action links** (Revoke, Delete, Edit) - Must have invisible tap target rect

**How to verify**: Search SVG for `height="` and check values. Any value <44 on an interactive element is a 🔴 REGENERATE issue.

**Common failures**:
- `height="40"` - Close but fails (often buttons/inputs)
- `height="36"` - Fails (old template default)
- `height="32"` - Fails significantly
- Text links without tap target rect - Fails

### 10. MOBILE-SPECIFIC ISSUES

- **Safe area violations** - Does content intrude on notch/home indicator areas?
- **Touch target size** - Verify 44px (covered in section 9, double-check here)
- **Thumb zone** - Are important actions in the thumb-reachable zone?
- **Status bar overlap** - Does any content go behind the status bar?
- **Keyboard avoidance** - Would the keyboard cover input fields?

### 11. CONTENT & TYPOGRAPHY

- **Typos** - Spell-check EVERYTHING
- **Orphaned words** - Single words on their own line?
- **Widow lines** - Very short final lines in paragraphs?
- **Line length** - Are any lines too long (>75 characters)?
- **Placeholder vs real content** - Is there lazy "Lorem ipsum" anywhere?

### 12. SPEC COMPLIANCE (Cross-reference spec.md - MANDATORY)

**Before reviewing ANY wireframe, READ THE SPEC FIRST.**

Location: `features/[category]/[feature-folder]/spec.md`

#### Extraction Checklist
- [ ] List ALL functional requirements (FR-XXX)
- [ ] List ALL success criteria (SC-XXX)
- [ ] List ALL non-functional requirements (NFR-XXX)
- [ ] Note any user stories that imply specific UI elements

#### Coverage Verification
For EACH requirement, ask:
- **Is it visualized?** - Does ANY wireframe show this requirement?
- **Is it labeled?** - Is there an annotation pointing to where it's demonstrated?
- **Is it accurate?** - Does the wireframe match what the spec describes?

#### Common Gaps to Catch
- **Missing states** - Spec mentions error/loading/empty states, wireframe only shows happy path
- **Missing user roles** - Spec has admin vs member views, wireframe only shows one
- **Missing flows** - Spec describes multi-step process, wireframe only shows step 1
- **Missing edge cases** - Spec mentions "if X then Y", wireframe doesn't show Y
- **Phantom requirements** - Wireframe shows FR-XXX label but that FR doesn't exist in spec

#### Severity for Spec Issues
- **CRITICAL**: Entire FR/SC not visualized anywhere
- **MAJOR**: FR partially shown but missing key aspect
- **MINOR**: FR shown but not annotated/labeled

---

## Severity Ratings

### CRITICAL (Must fix before implementation)
- Content completely unreadable
- Major layout collision/overlap
- Missing functional requirements
- Accessibility failure (contrast below 4.5:1)
- Elements clipped to invisibility

### MAJOR (Should fix, impacts quality)
- Partial text truncation
- Significant spacing inconsistency
- Panel boundary violations
- Touch target too small
- AAA contrast failure (below 7:1)

### MINOR (Nice to fix, polish)
- Slight misalignment (1-2px)
- Minor spacing inconsistency
- Suboptimal arrangement
- Cosmetic imperfections

---

## Issue Classification (🟢 vs 🔴) - BINARY ONLY

**CRITICAL**: Every issue must be classified as EITHER patchable OR regeneration-required. There is NO third option.

### 🟢 PATCHABLE (safe to auto-fix)
- Missing CSS class definition
- Wrong color hex value
- Font size too small
- Typo in visible text

### 🔴 REGENERATE (do NOT attempt to patch)
- Layout overlap/collision
- Element positioning (x, y, transform)
- Spacing issues (cramped, gaps, wasted space)
- Canvas size problems
- Row/section arrangement
- Touch target sizing (may need layout reflow)
- **Missing content/rows** (e.g., "missing sessions row")
- **Any structural addition or removal**

### ❌ NO EXCEPTIONS - EVERY ISSUE GETS FIXED

If you find a problem, log it. If you log it, it gets fixed. No exceptions.

- 🟢 → will be patched in place by `/wireframe` (preserves layout)
- 🔴 → will be regenerated by `/wireframe` (uses feedback)

**There is no "acceptable as-is."** The review's job is to be rigorous. If something is wrong, it's wrong. Log it, classify it, and it will be fixed.

**Rule**: If ANY issue in a file is 🔴, the ENTIRE file needs regeneration. Do NOT patch other issues in that file - they'll be overwritten anyway.

---

## 🔴 Regeneration Feedback (REQUIRED)

When flagging a file for regeneration, you MUST provide constructive feedback - not just "regenerate":

### Template for Regeneration Cases

```markdown
## 🔴 REGENERATION REQUIRED: [filename.svg]

### Diagnosis
What's visually broken (be specific: coordinates, element names, overlap areas)

### Root Cause
WHY the layout doesn't work (not just "it overlaps" - explain the structural problem)

### Suggested Layout
Concrete alternative arrangement:
- Row 1: [what should be here]
- Row 2: [what should be here]
- Consider: [specific layout approach]

### Spec Requirements to Preserve
FR/SC items the regenerated version must still demonstrate
```

### Example Feedback (from 004 failure)

```markdown
## 🔴 REGENERATION REQUIRED: 01-responsive-navigation.svg

### Diagnosis
Mobile breakpoints row (4 devices horizontal at y=240) collides with Mobile Expanded Nav
phone frame. The 320px device extends to x=1090, but expanded nav starts at x=980.
They overlap by 110px.

### Root Cause
Trying to fit 4 mobile device previews + 1 full-height phone frame in a single row.
Too much horizontal content for 1400px canvas.

### Suggested Layout
- Row 1: Desktop + Tablet headers (1024px and 768px views)
- Row 2: Mobile breakpoints 2x2 grid (LEFT) + Expanded Nav phone (RIGHT)
- Row 3: Requirements panel (full width, below both)

This separates dense mobile content from the full-height phone, eliminating collision.

### Spec Requirements to Preserve
- FR-001: Viewport fit (320-428px, no h-scroll)
- FR-002: Proportional shrinking
- FR-004: 44x44px touch targets (show actual measurements)
- FR-005: 8px spacing minimum
```

**Why this matters**: This feedback passes to `/wireframe` so the regeneration attempt has guidance, not just "try again and hope for better."

---

## Batch Mapping

| Batch | Features |
|-------|----------|
| 1 | 000-rls-implementation, 001-wcag-aa-compliance, 002-cookie-consent, 003-user-authentication, 004-mobile-first-design, 005-security-hardening, 006-template-fork-experience |
| 2 | 007-e2e-testing-framework, 008-on-the-account, 009-user-messaging-system, 010-unified-blog-content, 011-group-chats, 012-welcome-message-architecture |
| 3 | 013-oauth-messaging-password, 014-admin-welcome-email-gate, 015-oauth-display-name, 016-messaging-critical-fixes |
| 4 | 017-colorblind-mode, 018-font-switcher, 019-google-analytics, 020-pwa-background-sync, 021-geolocation-map |
| 5 | 022-web3forms-integration, 023-emailjs-integration, 024-payment-integration, 025-blog-social-features, 026-unified-messaging-sidebar |
| 6 | 027-ux-polish, 028-enhanced-geolocation, 029-seo-editorial-assistant, 030-calendar-integration |
| 7 | 031-standardize-test-users, 032-signup-e2e-tests, 033-seo-library-tests |

---

## Review Process

### 1. Read the Spec FIRST (MANDATORY)

```bash
# Location pattern
features/[category]/[feature-folder]/spec.md
```

Extract and document:
- All FR-XXX (Functional Requirements)
- All SC-XXX (Success Criteria)
- All NFR-XXX (Non-Functional Requirements)
- Key user stories and flows

**Do NOT proceed to SVG review until you have the requirements list.**

### 2. Read Each SVG (visual inspection via Read tool)

### 3. For EACH wireframe, work through ALL 11 category checklists above

Don't rush. Spend time on each SVG. Zoom in mentally on different regions.

### 4. Document EVERY issue found

```markdown
# Wireframe Issues: [Feature Name]

## Summary
- **Files reviewed**: X SVGs
- **Issues found**: X total (X critical, X major, X minor)
- **Pass**: N
- **Reviewed on**: YYYY-MM-DD

## Review History
| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1 | 2026-01-01 | 12 | - | 12 | 12 |
| 2 | 2026-01-01 | 8 | 6 | 2 | 8 |

## Issues by File

### [filename.svg]

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Row collision | Major | 🔴 | Pass 1 | y=240-280 | Mobile device row overlaps with "MOBILE EXPANDED NAV" section | Move expanded nav to right side or increase vertical spacing by 60px |
| 2 | Contrast | Major | 🟢 | ✅ RESOLVED | FR cards | #8b5cf6 text on #e8d4b8 = 3.2:1, fails AAA | Use #6d28d9 for 7:1 ratio |
| 3 | Cramped | Minor | 🔴 | NEW Pass 2 | 320px device | Logo and icons too close, no breathing room | Reduce logo width or stack icons |
```

**Status values:**
- `Pass N` - Issue first found in Pass N, still exists
- `NEW Pass N` - Issue newly discovered in Pass N
- `✅ RESOLVED` - Issue was fixed (keep for history)

### 5. Include "Suggested Fix" for every issue

Don't just identify problems - propose solutions.

### 6. Update Progress Tracker

File: `docs/design/WIREFRAME_REVIEW_PLAN.md`

---

## Report Format

```markdown
## Batch X Critical Review Complete

### Numbers
- Features: X
- SVGs: X
- **Critical issues**: X (MUST FIX)
- **Major issues**: X (SHOULD FIX)
- **Minor issues**: X (NICE TO FIX)

### Most Problematic Files
1. [filename.svg] - X issues (X critical)
2. [filename.svg] - X issues

### Issue Breakdown by Category
| Category | Count | Examples |
|----------|-------|----------|
| Overlap/Collision | X | Row 1/2 collision in 004-mobile-first |
| Spacing | X | Cramped device previews |
| Contrast | X | Muted text fails AAA |
| ... | | |

### Immediate Action Items
1. **CRITICAL**: [specific issue and file]
2. **CRITICAL**: [specific issue and file]

### Regeneration Candidates
These wireframes have enough issues to warrant regeneration rather than patching:
- [feature]: X issues, structural problems
```

---

## Arguments

- `batch 1-10` - Review specific batch
- `all` - Review everything
- `[feature-number]` - Single feature (e.g., `004`)
- `re-review [feature]` - Re-review after fixes

---

## Remember

**Your job is to make these wireframes BETTER, not to make the creator feel good.**

Find the flaws. Document them clearly. Propose fixes. Be relentless.

---

## After Review

### Single Command: `/wireframe [feature]`

The `/wireframe` command now handles everything intelligently:

```bash
/wireframe 004    # Smart: patches 🟢, regenerates 🔴, skips ✅
```

**What it does:**

| File has... | Action |
|-------------|--------|
| No issues | ✅ SKIP - already good |
| Only 🟢 issues | 🟢 PATCH in place (color, font, typo, CSS) |
| Any 🔴 issues | 🔴 REGENERATE with feedback |

The command will:
- Read WIREFRAME_ISSUES.md and triage each file
- Patch 🟢 files directly (preserves existing layout)
- Regenerate 🔴 files using the feedback (Diagnosis, Suggested Layout, etc.)
- Update WIREFRAME_ISSUES.md with completion status

### Simplified Workflow

```
/wireframe-review [feature]     # Review → classify 🟢/🔴 → create WIREFRAME_ISSUES.md
    ↓
/wireframe [feature]            # Smart: patches 🟢, regenerates 🔴, skips ✅
    ↓
(repeat until all issues resolved)
```

**Note**: `/wireframe-fix` is deprecated - `/wireframe` now handles both.

### Lesson Learned (004 Failure)

**DO NOT** try to patch structural issues. The 004-mobile-first-design attempt to "fix" overlap by extending canvas and moving elements made things WORSE - creating new overlaps and wasted space. When layout is broken, regenerate fresh.
