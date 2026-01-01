---
description: "⚠️ DEPRECATED - Use /wireframe instead (now handles both patching and regeneration)"
---

# ⚠️ DEPRECATED: Wireframe Fix

**This command is deprecated.** Use `/wireframe` instead.

The `/wireframe` command now handles the full lifecycle:
- Patches 🟢 issues (color, font, typo, CSS class) in place
- Regenerates 🔴 files (structural issues) with feedback
- Skips files with no issues

## New Workflow

```
/wireframe-review [feature]     # Creates WIREFRAME_ISSUES.md
/wireframe [feature]            # Smart: patches 🟢, regenerates 🔴
```

---

# Legacy Documentation (for reference)

Fix documented issues for a feature's wireframes. Skips files needing regeneration.

## Usage

```bash
/wireframe-fix [feature-number]
```

## Arguments

- `feature-number`: The 3-digit feature number (e.g., `004`, `000`, `017`)

## Behavior

1. **Locate** `docs/design/wireframes/[feature-folder]/WIREFRAME_ISSUES.md`
2. **Parse** all unfixed issues (rows without ✅)
3. **Triage each SVG file**:
   - If ANY issue requires regeneration → skip file, flag for `/wireframe`
   - If all issues are patchable → apply fixes
4. **Apply** fixes to patchable SVG files only
5. **Update** WIREFRAME_ISSUES.md with status markers
6. **Report** summary: files patched vs. files needing regeneration

## 🟢 Patchable Issues (NARROW list)

**ONLY these 4 things can be safely patched:**

| Issue Type | Why Safe | Fix Method |
|------------|----------|------------|
| Missing CSS class | Add to `<style>`, no layout impact | Insert class definition |
| Wrong color value | Single attribute change | Find/replace hex in fill/stroke |
| Font size too small | Single attribute change | Update `font-size` attribute |
| Typo in text | Single text node | Update text content |

**That's it.** Nothing that involves x/y positions, transforms, or element arrangement.

---

## 🔴 DO NOT PATCH - Flag for Regeneration

If ANY of these issues exist → **skip the ENTIRE file**:

| Category | Detection Keywords | Why Regenerate |
|----------|-------------------|----------------|
| **Layout/Structure** | overlap, collision, swap, move, rearrange | Requires holistic layout decisions |
| **Spacing/Positioning** | cramped, spacing, gap, wasted space | Affects multiple elements in cascade |
| **Element Position** | x=, y=, transform, shift, extend | Changes coordinate system |
| **Canvas/Size** | canvas, 1600, resize, extend | Structural change |
| **Missing Content** | missing row, missing section, add content, new panel | Requires design decisions |
| **Touch targets** | 44x44, touch target, undersized | May need layout reflow |
| **Element counts** | too many, add device, remove | Structural change |

**Why**: Patching structural issues creates cascading problems. The 004-mobile-first-design disaster proved this - patching made it WORSE.

## ❌ NO EXCEPTIONS - EVERY ISSUE GETS FIXED

There are only two outcomes:
- 🟢 **PATCH** → Apply the fix now
- 🔴 **REGENERATE** → Skip the entire file, flag for `/wireframe`

**If the review found it, it gets fixed.** No "acceptable as-is." No "deferred." No discretion. The review's job is to find problems. The fix command's job is to fix them. Every. Single. One.

## Example Output

```
/wireframe-fix 004

Analyzing WIREFRAME_ISSUES.md for 004-mobile-first-design...

Found 4 SVG files with 23 total issues.

Triaging files...
  01-responsive-navigation.svg: 15 issues
    🔴 REGENERATE - contains structural issues (overlap, cramped, spacing)
  02-content-typography.svg: 3 issues
    🟢 1 patchable (color), 🔴 2 need regeneration (spacing)
  03-touch-targets.svg: 2 issues
    🟢 All patchable (color only)
  04-breakpoint-system.svg: 3 issues
    🔴 REGENERATE - contains structural issues (cramped)

Applying fixes to 🟢 files only...
  🔴 01-responsive-navigation.svg: SKIPPED (needs regeneration)
  🔴 02-content-typography.svg: SKIPPED (contains 🔴 issues)
  ✅ 03-touch-targets.svg: 2 color fixes applied
  🔴 04-breakpoint-system.svg: SKIPPED (needs regeneration)

Summary: 1 file patched, 3 files need regeneration

Next steps:
  /wireframe 004   # Regenerate 01, 02, 04 from spec with feedback
```

## Typical Output (Most Files Need Regeneration)

With the stricter criteria, **most** files with issues will need regeneration:

```
/wireframe-fix 010

Found 5 SVG files with 12 total issues.

Triaging...
  01-blog-list.svg: 🟢 patchable (typo + color)
  02-offline-editor.svg: 🔴 regenerate (cramped layout)
  03-conflict-resolution.svg: 🔴 regenerate (canvas extension)
  04-migration-dashboard.svg: 🔴 regenerate (overlap)
  05-content-sync.svg: 🟢 patchable (missing CSS class)

Summary: 2 files patched, 3 files need regeneration
```

**This is expected.** Better to regenerate cleanly than patch into a mess.

## Workflow

```
/wireframe-review batch N       # Creates WIREFRAME_ISSUES.md
    ↓
Review issues, decide what to fix
    ↓
/wireframe-fix [feature]        # Auto-fix patchable issues
    ↓
/wireframe [feature]            # Regenerate any flagged files
```

## Related Commands

- `/wireframe-review` - Review wireframes and create WIREFRAME_ISSUES.md
- `/wireframe` - Generate/regenerate wireframes from spec
