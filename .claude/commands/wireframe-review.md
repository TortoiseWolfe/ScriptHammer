---
description: Critically review SVG wireframes with ruthless attention to detail. Find EVERY flaw.
---

## User Input

```text
$ARGUMENTS
```

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

### 9. MOBILE-SPECIFIC ISSUES

- **Safe area violations** - Does content intrude on notch/home indicator areas?
- **Touch target size** - Are ALL tappable elements at least 44x44px?
- **Thumb zone** - Are important actions in the thumb-reachable zone?
- **Status bar overlap** - Does any content go behind the status bar?
- **Keyboard avoidance** - Would the keyboard cover input fields?

### 10. CONTENT & TYPOGRAPHY

- **Typos** - Spell-check EVERYTHING
- **Orphaned words** - Single words on their own line?
- **Widow lines** - Very short final lines in paragraphs?
- **Line length** - Are any lines too long (>75 characters)?
- **Placeholder vs real content** - Is there lazy "Lorem ipsum" anywhere?

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

### 1. Read Each SVG (visual inspection via Read tool)

### 2. For EACH wireframe, work through ALL 10 category checklists above

Don't rush. Spend time on each SVG. Zoom in mentally on different regions.

### 3. Document EVERY issue found

```markdown
# Wireframe Issues: [Feature Name]

## Summary
- **Files reviewed**: X SVGs
- **Issues found**: X total (X critical, X major, X minor)
- **Reviewed on**: YYYY-MM-DD

## Issues by File

### [filename.svg]

| # | Category | Severity | Location | Description | Suggested Fix |
|---|----------|----------|----------|-------------|---------------|
| 1 | Row collision | Major | y=240-280 | Mobile device row overlaps with "MOBILE EXPANDED NAV" section | Move expanded nav to right side or increase vertical spacing by 60px |
| 2 | Contrast | Major | FR cards | #8b5cf6 text on #e8d4b8 = 3.2:1, fails AAA | Use #6d28d9 for 7:1 ratio |
| 3 | Cramped | Minor | 320px device | Logo and icons too close, no breathing room | Reduce logo width or stack icons |
```

### 4. Include "Suggested Fix" for every issue

Don't just identify problems - propose solutions.

### 5. Update Progress Tracker

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
