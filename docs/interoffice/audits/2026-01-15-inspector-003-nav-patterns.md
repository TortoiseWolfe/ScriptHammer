# Inspector Audit: 003 User Authentication Nav Patterns

**Date:** 2026-01-15
**Inspector:** Inspector Terminal
**Scope:** Compare 003-user-authentication nav patterns vs passing SVGs

---

## 1. What Pattern Do Passing SVGs Use?

Passing SVGs (e.g., `006-template-fork-experience/01-service-setup-guidance.svg`) use:

### Desktop Header

- Uses include: `<use href="includes/header-desktop.svg#desktop-header" x="0" y="0"/>`
- Nav items: Home, Features, Docs, Account (via include)
- **Active state overlay**: Custom rect + text placed AFTER the include to highlight active page

### Desktop Footer

- Uses include: `<use href="includes/footer-desktop.svg#site-footer" x="0" y="640"/>`
- Contains: ScriptHammer brand, nav links, copyright
- Background: `path` element with rounded BOTTOM corners only

### Mobile Header

- Uses include: `<use href="includes/header-mobile.svg#mobile-header-group" x="0" y="0"/>`

### Mobile Bottom Nav

- Uses include: `<use href="includes/footer-mobile.svg#mobile-bottom-nav" x="0" y="664"/>`
- 4 tabs: Home, Features, Docs, Account
- **Active state**: Custom group with filled background and white text/icon AFTER the include

### Include Files (Reference)

| Include              | ID                     | Content                                    |
| -------------------- | ---------------------- | ------------------------------------------ |
| `header-desktop.svg` | `#desktop-header`      | Logo + nav + accessibility/settings/avatar |
| `footer-desktop.svg` | `#site-footer`         | Brand + nav links + copyright              |
| `header-mobile.svg`  | `#mobile-header-group` | Logo + hamburger                           |
| `footer-mobile.svg`  | `#mobile-bottom-nav`   | 4-tab nav bar with icons                   |

---

## 2. What Do 003 SVGs Have?

All three 003 SVGs follow the same nav pattern:

### Desktop Header

- **CORRECT**: Uses `<use href="includes/header-desktop.svg#desktop-header" x="0" y="0"/>`
- **CORRECT**: Active state overlay for "Account" tab:
  ```xml
  <rect x="660" y="3" width="80" height="44" rx="4" fill="#8b5cf6"/>
  <text x="700" y="31" text-anchor="middle" fill="#ffffff" ...>Account</text>
  ```

### Desktop Footer

- **CORRECT**: Uses `<use href="includes/footer-desktop.svg#site-footer" x="0" y="640"/>`

### Mobile Header

- **CORRECT**: Uses `<use href="includes/header-mobile.svg#mobile-header-group" x="0" y="0"/>`

### Mobile Bottom Nav

- **CORRECT**: Uses `<use href="includes/footer-mobile.svg#mobile-bottom-nav" x="0" y="664"/>`
- **ISSUE**: Active state overlay for Account tab:
  ```xml
  <g transform="translate(270, 664)">
    <rect width="90" height="56" rx="0" fill="#8b5cf6"/>  <!-- rx="0" - no rounded corners -->
    <text x="45" y="44" ...>Account</text>
  </g>
  ```

  - **Missing**: Icon path (only text, no icon)
  - **Missing**: Rounded corners on rightmost tab (`rx="24"` expected)

---

## 3. Icon Consistency Analysis

### Include Files Define Icons

The `footer-mobile.svg` include contains SVG path icons for each tab:

- **Home**: House icon (path data ~150 chars)
- **Features**: Lightning bolt icon
- **Docs**: Document icon
- **Account**: Person silhouette icon

### 003 Active State Overlays

All three 003 SVGs use **text-only** active state overlays:

```xml
<g transform="translate(270, 664)">
  <rect width="90" height="56" rx="0" fill="#8b5cf6"/>
  <text x="45" y="44" ... fill="#ffffff" ...>Account</text>
</g>
```

**Missing from overlay:**

1. Icon path (should be white-filled version of Account icon)
2. Proper rounded corners (`rx="24"` for rightmost tab)

### What Passing SVGs Do

Passing SVGs like 006 use the same pattern but **all failing SVGs have this same gap** - the active state template in `footer-mobile.svg` comment block shows the correct approach but isn't being followed.

---

## 4. Why Wasn't This Caught?

### Inspector Limitations

1. **No Icon Check in Inspector**
   - `inspect-wireframes.py` lines 236-248 detect active nav page based on filename keywords
   - No check verifies that active state overlays include icons
   - Inspector only looks for the include reference, not overlay completeness

2. **rx Check Pattern Too Narrow**
   - `inspect-wireframes.py` lines 251-263 check for `rx=` in footer area rects
   - The pattern looks for rects in the footer container, not the active state overlay
   - Active state overlays use `rx="0"` which is technically valid XML

3. **Active State Template Not Enforced**
   - `footer-mobile.svg` contains a comment block (lines 56-72) showing correct active state template
   - This template is documentation only, not validated
   - Generators copy the basic structure but omit the icon paths

### Root Cause: Template Incompleteness

The footer-mobile.svg comment template shows:

```xml
<!-- ACTIVE STATE TEMPLATE (copy to wireframe to activate a tab)
To make Account active (bottom-right rounded rx=24), use:
  <path d="M 0 0 L 90 0 L 90 32 A 24 24 0 0 1 66 56 L 0 56 L 0 0 Z" fill="#8b5cf6"/>
-->
```

But generators are using:

```xml
<rect width="90" height="56" rx="0" fill="#8b5cf6"/>
```

**The template comment exists but isn't being followed.**

---

## 5. Recommendations

### A. Add New Inspector Check: `active_state_icon_missing`

```python
# Check that mobile active state overlays include an icon path
active_overlay_pattern = r'transform="translate\(270, 664\)"[^>]*>.*?<path[^>]*fill="#fff"'
```

### B. Add New Inspector Check: `active_state_corners`

```python
# Check that corner tab overlays use proper rounded path, not rect
corner_tab_pattern = r'<rect[^>]*width="90"[^>]*height="56"[^>]*rx="0"'
```

### C. Update Generator Guidance

Add to `wireframe-pipeline.md`:

```markdown
### Mobile Active State (CRITICAL)

- For corner tabs (Home, Account), use `<path>` not `<rect>`
- Include white-filled icon path in overlay
- Copy exact template from footer-mobile.svg comment block
```

### D. Create Reusable Active State Includes

Add to `includes/` directory:

- `active-state-home.svg` - Left corner tab with icon
- `active-state-account.svg` - Right corner tab with icon
- `active-state-middle.svg` - Middle tabs template

---

## Summary

| Aspect                 | 003 SVGs | Expected                     |
| ---------------------- | -------- | ---------------------------- |
| Desktop header include | CORRECT  | uses header-desktop.svg      |
| Desktop footer include | CORRECT  | uses footer-desktop.svg      |
| Mobile header include  | CORRECT  | uses header-mobile.svg       |
| Mobile footer include  | CORRECT  | uses footer-mobile.svg       |
| Desktop active state   | CORRECT  | rect + text overlay          |
| Mobile active state    | PARTIAL  | text-only, missing icon + rx |

**Status:** 003 SVGs use nav includes correctly but mobile active states are incomplete.
**Impact:** Visual inconsistency - active mobile tabs show text without icons.
**Detection Gap:** Inspector doesn't validate active state overlay completeness.
