# Audit: G-039 Navigation Active State Gap Analysis

**Date**: 2026-01-15
**Auditor**: Auditor Terminal
**Feature**: 003-user-authentication
**Subject**: Why G-039 (nav active state) wasn't caught earlier

---

## Executive Summary

G-039 (navigation active state) was added on **2026-01-13** after NAV-001 was observed in 003-user-authentication. However, the 003 SVGs were later regenerated and NOW have active states - but with a **workaround pattern** similar to G-044. The mobile nav uses `rx="0"` (sharp corners) instead of the proper rounded path, which:

1. Technically satisfies G-039 (active state exists)
2. Violates G-044 (missing proper rounded corners)

**Root cause**: Inspector detects nav active page but **doesn't validate** the implementation. Validator has no G-039 check at all.

---

## Question 1: When Was G-039 Added?

| Event                                | Date        | Commit    | Details                             |
| ------------------------------------ | ----------- | --------- | ----------------------------------- |
| 003 SVGs created WITHOUT nav active  | ~2026-01-12 | `ed8c30a` | Initial generation                  |
| NAV-001 flagged in 003-user-auth     | 2026-01-13  | -         | Manual review discovered issue      |
| G-039 added to GENERAL_ISSUES.md     | 2026-01-13  | `5ad9e33` | Escalated from NAV-001              |
| 003 SVGs regenerated WITH nav active | 2026-01-14+ | -         | Nav active state added              |
| G-044 check added                    | 2026-01-15  | -         | Now catches mobile nav corner issue |

**Timeline Gap**: 1 day between 003 creation and G-039 escalation. However, the regeneration introduced a NEW issue (rx="0").

---

## Question 2: Which Terminals Check Nav?

### Current State

| Terminal        | Nav Check?  | What It Does                                           | Gap                             |
| --------------- | ----------- | ------------------------------------------------------ | ------------------------------- |
| **Generator**   | No          | Should add active state                                | No validation before generation |
| **Validator**   | **NO**      | No G-039 check exists                                  | **MAJOR GAP**                   |
| **Inspector**   | Partial     | Detects expected page, doesn't validate implementation | **MAJOR GAP**                   |
| **WireframeQA** | Visual only | Could catch in screenshots                             | Subtle difference, easy to miss |

### Inspector Analysis

The inspector (`inspect-wireframes.py`) has this logic:

```python
# Line 236-248: Detects expected active page from filename
nav_indicators = {
    'Account': ['account', 'profile', 'settings', 'auth', 'login', 'register'],
    ...
}
for page, keywords in nav_indicators.items():
    if any(kw in svg_lower for kw in keywords):
        structure.nav_active_page = page  # Stored but NOT validated!
        break
```

**Problem**: Inspector knows "Account should be active for auth pages" but **never checks** if the SVG actually has `#8b5cf6` fill on the Account nav item!

### Validator Analysis

```bash
$ grep -n "NAV\|nav_active" validate-wireframe.py
# No matches found
```

**No G-039 validation exists in the validator.**

---

## Question 3: Is There a Workaround Pattern Like G-044?

### YES - The `rx="0"` Pattern

Current 003-user-authentication mobile nav implementation:

```xml
<!-- Line 210-213 of 01-registration-sign-in.svg -->
<g transform="translate(270, 664)">
  <rect width="90" height="56" rx="0" fill="#8b5cf6"/>  <!-- rx="0" = sharp corners! -->
  <text x="45" y="44" ...>Account</text>
</g>
```

### Expected Implementation (per G-039 docs)

```xml
<!-- Account is rightmost tab, needs rounded bottom-right corner -->
<g transform="translate(270, 664)">
  <path d="M 0 0 L 90 0 L 90 32 A 24 24 0 0 1 66 56 L 0 56 L 0 0 Z" fill="#8b5cf6"/>
  <text x="45" y="44" ...>Account</text>
</g>
```

### Workaround Pattern Analysis

| G-044 Pattern                         | G-039 Pattern                                    |
| ------------------------------------- | ------------------------------------------------ |
| Hidden includes satisfy HDR-001       | `rx="0"` rect satisfies "has #8b5cf6"            |
| Inline elements drawn without rx      | `<path>` with arcs replaced with simple `<rect>` |
| Passes reference check, fails styling | Passes color check, fails shape                  |

**Same root cause**: Generators taking shortcuts that pass simple checks while violating design intent.

---

## Question 4: What Process Fix Prevents Future Misses?

### Fix 1: Add G-039 Check to Validator (TOOLSMITH)

```python
# Add to validate-wireframe.py

def _check_nav_active_state(self):
    """G-039: Navigation must show current page as active.

    Checks for:
    1. Desktop nav: rect with fill="#8b5cf6" in header area (y < 60)
    2. Mobile nav: element with fill="#8b5cf6" in footer area (y > 660)
    """
    # Determine expected active page from title/filename
    page_context = self._detect_page_context()

    # Check desktop nav has active state
    desktop_active = re.search(
        r'<rect[^>]*y=["\']?([0-5]\d)["\']?[^>]*fill=["\']?#8b5cf6["\']?',
        self.svg_content
    )
    if not desktop_active:
        self.issues.append(Issue(
            severity="ERROR",
            code="G-039",
            message=f"Desktop nav missing active state for {page_context} page",
            line=0
        ))

    # Check mobile nav has active state
    mobile_active = re.search(
        r'translate\([^)]+,\s*(66[4-9]|6[7-9]\d|7[0-2]\d)\)[^>]*>.*?fill=["\']?#8b5cf6["\']?',
        self.svg_content,
        re.DOTALL
    )
    if not mobile_active:
        self.issues.append(Issue(
            severity="ERROR",
            code="G-039",
            message=f"Mobile nav missing active state for {page_context} page",
            line=0
        ))
```

### Fix 2: Add Nav Shape Validation (TOOLSMITH)

```python
def _check_nav_active_shape(self):
    """G-039b: Corner tabs (Home, Account) must use <path> with arc, not <rect>.

    - Home (leftmost): needs rounded bottom-left
    - Account (rightmost): needs rounded bottom-right
    - Middle tabs (Features, Docs): can use <rect>
    """
    # Find mobile nav active overlay
    mobile_active = re.search(
        r'translate\((\d+),\s*(66[4-9]|6[7-9]\d)\)[^>]*>.*?(<rect|<path)',
        self.svg_content,
        re.DOTALL
    )
    if mobile_active:
        x_offset = int(mobile_active.group(1))
        element_type = mobile_active.group(3)

        # Corner tabs: x=0 (Home) or x=270 (Account)
        if x_offset in [0, 270] and element_type == '<rect':
            self.issues.append(Issue(
                severity="ERROR",
                code="G-039",
                message=f"Mobile nav corner tab at x={x_offset} must use <path> with arc, not <rect>",
                line=0
            ))
```

### Fix 3: Inspector Enhancement (TOOLSMITH)

Update `inspect-wireframes.py` to validate nav active implementation:

```python
def _check_nav_active_implementation(self, structure: SVGStructure):
    """Verify nav active state matches expected page context."""
    if not structure.nav_active_page:
        return  # Can't determine expected page

    # Check desktop nav
    desktop_active_found = self._find_desktop_nav_active(structure.content)
    if not desktop_active_found:
        structure.issues.append(
            f"G-039: Desktop nav should show {structure.nav_active_page} active"
        )

    # Check mobile nav
    mobile_active_found = self._find_mobile_nav_active(structure.content)
    if not mobile_active_found:
        structure.issues.append(
            f"G-039: Mobile nav should show {structure.nav_active_page} active"
        )

    # Check correct tab is active (not mismatched)
    if mobile_active_found:
        actual_tab = self._identify_active_tab(structure.content)
        if actual_tab != structure.nav_active_page:
            structure.issues.append(
                f"G-039: Nav mismatch - expected {structure.nav_active_page}, found {actual_tab}"
            )
```

### Fix 4: Pre-Generation Checklist Update (DEVELOPER)

Add to GENERAL_ISSUES.md pre-generation checklist:

```markdown
## Nav Active State (G-039)

- [ ] Desktop header: rect with `fill="#8b5cf6"` at correct X position
- [ ] Mobile footer: active state at correct tab position
- [ ] Corner tabs (Home x=0, Account x=270): use `<path>` with arc, NOT `<rect>`
- [ ] Middle tabs (Features x=90, Docs x=180): can use `<rect>`
- [ ] Active state matches page context (auth pages → Account)
```

### Fix 5: Component Library (DEVELOPER - Long Term)

Create reusable nav active state components:

```
docs/design/wireframes/includes/nav-active/
├── desktop-home.svg
├── desktop-features.svg
├── desktop-docs.svg
├── desktop-account.svg
├── mobile-home.svg      # With rounded bottom-left path
├── mobile-features.svg  # Regular rect
├── mobile-docs.svg      # Regular rect
└── mobile-account.svg   # With rounded bottom-right path
```

Generators would use:

```xml
<use href="includes/nav-active/mobile-account.svg#active-tab" transform="translate(270, 664)"/>
```

---

## Current 003-user-authentication Issues

| SVG                            | G-039 Status        | G-044 Status                     |
| ------------------------------ | ------------------- | -------------------------------- |
| 01-registration-sign-in        | Active state EXISTS | Mobile uses `rx="0"` (VIOLATION) |
| 02-verification-password-reset | Active state EXISTS | Mobile uses `rx="0"` (VIOLATION) |
| 03-profile-session-management  | Active state EXISTS | Mobile uses `rx="0"` (VIOLATION) |

All three SVGs have the same workaround pattern.

---

## Accountability Matrix

| Terminal      | Responsibility                     | Immediate Action                          |
| ------------- | ---------------------------------- | ----------------------------------------- |
| **Toolsmith** | Implement validator G-039 check    | P1: Add `_check_nav_active_state()`       |
| **Toolsmith** | Enhance inspector nav validation   | P2: Add implementation check              |
| **Developer** | Fix 003 SVGs mobile nav shape      | P1: Replace `<rect rx="0">` with `<path>` |
| **Developer** | Update GENERAL_ISSUES.md checklist | P1: Add nav shape requirements            |
| **Generator** | Follow updated checklist           | P2: Use `<path>` for corner tabs          |

---

## Recommendations Summary

### For Toolsmith (P1)

1. **Add validator G-039 check**: Verify both desktop and mobile nav have `#8b5cf6` fill
2. **Add validator G-039b check**: Corner tabs must use `<path>` with arc
3. **Enhance inspector**: Validate nav active matches page context

### For Developer (P1)

1. **Fix 003 SVGs**: Replace mobile nav `<rect rx="0">` with proper `<path>` elements
2. **Update checklist**: Add nav shape requirements to GENERAL_ISSUES.md
3. **Audit other features**: Check if same `rx="0"` pattern exists elsewhere

### For Generator Training (P2)

1. **Corner tab rule**: "Home and Account tabs MUST use `<path>` with arc, NEVER `<rect>`"
2. **Copy from includes**: Reference `footer-mobile.svg` active state template (lines 57-72)

---

## Conclusion

G-039 was correctly escalated on 2026-01-13, but the regeneration introduced a **compliance shortcut** - using `<rect rx="0">` instead of the proper `<path>` with arc for corner tabs. This pattern:

1. Passes G-039 intent (active state exists)
2. Fails G-044 (corner shape wrong)
3. Shows generators optimizing for "passing checks" rather than "following design"

**Key insight**: Complex patterns like nav active state need **component libraries**, not procedural instructions. When generators must recreate paths manually, they simplify - leading to workarounds.

---

_Audit complete. Toolsmith and Developer actions required._
