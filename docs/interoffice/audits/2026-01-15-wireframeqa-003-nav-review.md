# Navigation Review: 003-user-authentication

**Date**: 2026-01-15
**Reviewer**: WireframeQA
**Source**: overviews_004/
**Feature**: 003-user-authentication (3 SVGs)

---

## Summary

| SVG    | Active Page Identifiable? | Active Indicator? | Nav Icons Visible? | Issues                      |
| ------ | ------------------------- | ----------------- | ------------------ | --------------------------- |
| 003:01 | YES                       | YES               | PARTIAL            | Mobile Account icon missing |
| 003:02 | YES                       | YES               | PARTIAL            | Mobile Account icon missing |
| 003:03 | YES                       | YES               | PARTIAL            | Mobile Account icon missing |

---

## Detailed Analysis

### 003:01 - Registration and Sign In

**1. Can you identify which page is active?**

- YES - "Account" is clearly highlighted in both desktop header and mobile bottom nav

**2. Is there any active indicator?**

- YES - Desktop: Purple background (#8b5cf6) on "Account" nav item with white text
- YES - Mobile: Purple background (#8b5cf6) on "Account" tab with white text

**3. Are nav icons visible?**

- Desktop header: Text-only nav items (Home, Features, Docs, Account) + utility icons (eye, gear, avatar)
- Mobile bottom nav:
  - Home: House icon visible
  - Features: Lightning icon visible
  - Docs: Document icon visible
  - **Account: NO ICON - only text visible**

**Issue Found**: Mobile Account tab shows purple background and white "Account" text, but the user icon is NOT displayed.

---

### 003:02 - Verification and Password Reset

**1. Can you identify which page is active?**

- YES - "Account" highlighted in both viewports

**2. Is there any active indicator?**

- YES - Same purple (#8b5cf6) background treatment as 003:01

**3. Are nav icons visible?**

- Same pattern as 003:01
- **Account icon missing on mobile**

---

### 003:03 - Profile and Session Management

**1. Can you identify which page is active?**

- YES - "Account" highlighted in both viewports

**2. Is there any active indicator?**

- YES - Same purple (#8b5cf6) background treatment

**3. Are nav icons visible?**

- Same pattern as 003:01/003:02
- **Account icon missing on mobile**

---

## Root Cause Analysis

### WHY did visual review miss this?

1. **Overlay Implementation Bug**: The active state overlay in the SVG covers the include's icon but doesn't include its own white version of the user icon.

**Code in SVG (wrong)**:

```xml
<!-- Active state for Account tab (rightmost) -->
<g transform="translate(270, 664)">
  <rect width="90" height="56" rx="0" fill="#8b5cf6"/>
  <text x="45" y="44" text-anchor="middle" fill="#ffffff">Account</text>
</g>
```

**Should be (correct)**:

```xml
<g transform="translate(270, 664)">
  <path d="M 0 0 L 90 0 L 90 32 A 24 24 0 0 1 66 56 L 0 56 L 0 0 Z" fill="#8b5cf6"/>
  <g transform="translate(33, 6)">
    <path fill="#ffffff" fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"/>
  </g>
  <text x="45" y="44" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="600">Account</text>
</g>
```

2. **Missing from checklist**: Visual review didn't check that active state overlays include WHITE versions of icons, only checked for presence of active indicator.

3. **Include masking**: The `<use href="...">` include renders the default (inactive) icon, but the overlay `<rect>` covers it without replacing it.

4. **Rounded corners also wrong**: Overlay uses `<rect rx="0">` but should use `<path>` with rounded bottom-right corner to match container.

---

## Recommendations

### Immediate Fix (PATCH)

All 3 SVGs need the Account active overlay updated to include:

1. Proper path with rounded corner (not rect)
2. White (#ffffff) user icon
3. White text with font-weight="600"

### Process Improvement

Add to WireframeQA Visual Review Checklist:

- [ ] Active nav overlays include WHITE icons (not just text)
- [ ] Active overlays match container corner radius
- [ ] Icons visible in both active AND inactive states

### Validator Enhancement

Consider adding check to `validate-wireframe.py`:

- Active state overlays must contain icon path elements

---

## Classification

**Severity**: PATCH (visual only, no structural issues)
**Affected**: 003:01, 003:02, 003:03 (all 3 SVGs)
**Fix Scope**: Replace Account active overlay in mobile section

---

## Cross-Reference

This same issue likely exists in OTHER features using Account nav. Recommend full audit of:

- Any SVG with `transform="translate(270, 664)"` Account overlay
- Check if icon path is included in overlay group
