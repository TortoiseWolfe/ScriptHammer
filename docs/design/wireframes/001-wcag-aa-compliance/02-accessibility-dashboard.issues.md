# Issues: 02-accessibility-dashboard.svg

**Status**: 🟢 PATCHABLE (2 issues)
**Reviewed**: 2026-01-09

---

## Issue 1: Mobile Footer Active Tab Uses Emoji Instead of SVG Path (G-002)

**Classification**: 🟢 PATCHABLE

**Location**: Lines 336-340, mobile active tab overlay

**Current** (WRONG):
```xml
<g transform="translate(95, 634)">
  <rect width="85" height="56" fill="#8b5cf6"/>
  <text x="42" y="24" text-anchor="middle" font-size="18">⚡</text>
  <text x="42" y="44" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="11px" font-weight="600">Features</text>
</g>
```

**Expected** (per footer-mobile.svg template):
```xml
<g transform="translate(95, 634)">
  <rect width="85" height="56" fill="#8b5cf6"/>
  <g transform="translate(30, 6)">
    <path fill="#fff" d="M14.6152 1.59492C14.9164 1.76287 15.0643 2.1146 14.9736 2.44734L12.9819 9.75H20.25C20.5486 9.75 20.8188 9.92718 20.9378 10.2011C21.0569 10.475 21.0021 10.7934 20.7983 11.0117L10.2983 22.2617C10.063 22.5139 9.68601 22.573 9.38478 22.4051C9.08354 22.2371 8.93567 21.8854 9.02641 21.5527L11.018 14.25H3.74999C3.45134 14.25 3.18115 14.0728 3.06213 13.7989C2.9431 13.525 2.99792 13.2066 3.20169 12.9883L13.7017 1.73826C13.937 1.48613 14.314 1.42698 14.6152 1.59492Z"/>
  </g>
  <text x="42" y="44" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="11px" font-weight="600">Features</text>
</g>
```

**Root cause**: Used emoji shortcut `⚡` instead of copying the actual `<path>` element from `footer-mobile.svg` and changing fill to `#fff` for active state.

**Reference**: G-002 in GENERAL_ISSUES.md - "Placeholder icons (emoji, rectangles) instead of copying EXACT `<path>` elements from include files"

---

## Issue 2: Font Sizes Too Small in Requirements Key and User Stories

**Classification**: 🟢 PATCHABLE

**Location**: CSS `<style>` block (lines 29, 43)

| Class | Current | Should Be | Purpose |
|-------|---------|-----------|---------|
| `.legend-text` | 13px | 14px | Requirements Key descriptions |
| `.us-narrative` | 13px | 14px | User Story narrative text |

**Standard** (from /wireframe skill):
- Body Text = 14px Regular
- 13px is the MINIMUM, not the target

**Root cause**: Skill templates define 13px for these classes. Need SYSTEMIC fix:
1. Update `/wireframe` skill templates (Light + Dark theme CSS)
2. Patch all existing SVGs that use these classes

**Scope of systemic fix**:
- `.claude/commands/wireframe.md` - update template CSS
- All SVGs in `docs/design/wireframes/*/` using `.legend-text` or `.us-narrative`

---

## Summary

| Issue | Description | Classification |
|-------|-------------|----------------|
| 1 | Mobile footer uses emoji instead of SVG path | 🟢 PATCHABLE |
| 2 | Font sizes too small (.legend-text, .us-narrative = 13px) | 🟢 PATCHABLE |

**Next Actions**:
1. Fix skill template: Update `.claude/commands/wireframe.md` CSS (13px → 14px)
2. Run `/wireframe 001:02` to patch this SVG
3. Patch all other affected SVGs systemically
