# G-039 Nav Active State Check Analysis

**Date**: 2026-01-15
**Terminal**: Validator
**Topic**: Missing NAV-001 automated check for G-039

---

## Question 1: Does the check exist?

**NO** - The validator does NOT have a G-039/NAV-001 check.

### Evidence

```bash
$ grep -i "NAV-001\|G-039\|active.*state" validate-wireframe.py
# (no results for NAV-001 or G-039 active state check)
```

**What exists:**

- G-044 check for footer/nav rounded corners (line 1570)
- Header/footer include reference checks (HDR-001)
- Inspector detects `nav_active_page` from filename but does NOT verify implementation

**What's missing:**

- No validation that SVG contains active nav state overlays
- No check that desktop header has highlighted nav item
- No check that mobile footer has highlighted tab

---

## Question 2: Why didn't it catch 003?

**003-user-authentication IS COMPLIANT** - All 3 SVGs correctly implement active nav states.

### 003-01 (registration-sign-in.svg)

```xml
<!-- Desktop: Lines 27-29 -->
<!-- Active nav state for Account -->
<rect x="660" y="3" width="80" height="44" rx="4" fill="#8b5cf6"/>
<text x="700" y="31" text-anchor="middle" fill="#ffffff" ...>Account</text>

<!-- Mobile: Lines 209-212 -->
<!-- Active state for Account tab (rightmost) -->
<g transform="translate(270, 0)">
  <rect width="90" height="56" rx="0" fill="#8b5cf6"/>
  <text x="45" y="44" text-anchor="middle" fill="#ffffff" ...>Account</text>
</g>
```

### 003-02 (verification-password-reset.svg)

- Line 27: `<!-- Active nav state for Account -->`
- Line 208: `<!-- Active state for Account tab -->`
- Both have correct implementations

### 003-03 (profile-session-management.svg)

- Line 27: `<!-- Active nav state for Account -->`
- Line 193: `<!-- Active state for Account tab -->`
- Both have correct implementations

**Conclusion**: G-039 was escalated to GENERAL_ISSUES.md because it was seen in OTHER features, not 003. The 003 SVGs were generated correctly.

---

## Question 3: What check is needed?

### Proposed NAV-001 Check

**Purpose**: Verify SVGs have active nav state overlays in both desktop header and mobile footer.

### Detection Logic

1. **Desktop Active State**:
   - After `<use href="includes/header-desktop.svg#desktop-header"/>`, look for:
   - `<rect ... fill="#8b5cf6"/>` within y=0-50 range (header area)
   - Should contain nav item text (Home, Features, Docs, Account)

2. **Mobile Active State**:
   - After `<use href="includes/footer-mobile.svg#mobile-bottom-nav"/>`, look for:
   - `<rect ... fill="#8b5cf6"/>` or `<g>` with similar styling
   - Within mobile area (x >= 1360 or within mobile transform group)

### Pseudo-code

```python
def _check_nav_active_state(self):
    """NAV-001: Navigation must show active page indicator."""

    # Check desktop header has active overlay
    desktop_header_present = 'header-desktop.svg#desktop-header' in self.svg_content
    desktop_active_pattern = r'<rect[^>]*y=["\']?[0-4]\d["\']?[^>]*fill=["\']?#8b5cf6["\']?'
    has_desktop_active = bool(re.search(desktop_active_pattern, self.svg_content))

    if desktop_header_present and not has_desktop_active:
        self.issues.append(Issue(
            severity="ERROR",
            code="NAV-001",
            message="Desktop navigation missing active state indicator (fill=\"#8b5cf6\")"
        ))

    # Check mobile footer has active overlay
    mobile_footer_present = 'footer-mobile.svg#mobile-bottom-nav' in self.svg_content
    # Mobile active state is typically in transform group after footer include
    mobile_active_pattern = r'Active state for .* tab'  # Look for comment
    has_mobile_active = bool(re.search(mobile_active_pattern, self.svg_content))

    if mobile_footer_present and not has_mobile_active:
        self.issues.append(Issue(
            severity="ERROR",
            code="NAV-001",
            message="Mobile footer nav missing active state indicator"
        ))
```

### Challenges

1. **False positives**: Other purple rects (buttons) may trigger detection
2. **Position variance**: Active state overlay position varies by which page is active
3. **Comment reliance**: Some implementations use comments, others don't

### Recommended Approach

**Hybrid check**:

1. Look for comment pattern `<!-- Active (nav )?state for .* -->`
2. OR look for `fill="#8b5cf6"` rect within specific y-ranges:
   - Desktop: y=0-50 (header area relative to desktop group)
   - Mobile: y=664+ (footer area)
3. Only trigger if header/footer includes are present (don't check if SVG doesn't use includes)

---

## Toolsmith Action Items

### P1: Add NAV-001 Check to validate-wireframe.py

**File**: `docs/design/wireframes/validate-wireframe.py`

**Task**: Implement `_check_nav_active_state()` method with:

- Desktop active state detection
- Mobile active state detection
- Only trigger when includes are present
- Avoid false positives from other purple elements

**Acceptance Criteria**:

- Passing SVGs (003, etc.) should still pass
- SVGs missing active state should fail with NAV-001
- No false positives on button elements

### P2: Update Inspector to Verify Nav Active Page

**File**: `docs/design/wireframes/inspect-wireframes.py`

**Task**: Add cross-SVG check that `nav_active_page` (detected from filename) matches actual implementation.

**Example**:

- `003-user-authentication/01-registration-sign-in.svg` → nav_active_page = "Account"
- Verify SVG has "Account" highlighted, not "Home" or "Features"

### P3: Document NAV-001 in validator docstring

**File**: `docs/design/wireframes/validate-wireframe.py`

Update usage docstring to include NAV-001 in checks list.

---

## Reference: SVGs That Should Be Checked

Once NAV-001 is implemented, run against all SVGs to identify missing active states.

**Known compliant** (have active nav states):

- 003-user-authentication (all 3)
- Most SVGs generated after G-039 was documented (2026-01-13)

**Potentially non-compliant** (generated before G-039):

- Check all SVGs from 000, 001, 002, 004, 005, 006, 007, 008, 009
