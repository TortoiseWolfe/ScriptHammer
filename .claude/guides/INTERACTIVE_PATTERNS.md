# Interactive Element Patterns (WCAG AAA Compliant)

**All interactive elements MUST be at least 44×44px tap target.** This is non-negotiable for WCAG AAA compliance.

---

## Checkbox Pattern (44px tap target)

Checkboxes are visually 16x16px but MUST have a 44x44px invisible tap target:

```xml
<!-- Checkbox with 44px tap target -->
<g class="checkbox-field">
  <!-- Invisible 44x44 tap target (centered on checkbox) -->
  <rect x="-14" y="-14" width="44" height="44" rx="6" fill="transparent"/>
  <!-- Visual checkbox (16x16) -->
  <rect x="0" y="0" width="16" height="16" rx="3" fill="#f5f0e6" stroke="#b8a080"/>
  <!-- Label text -->
  <text x="24" y="13" class="text-sm">Remember me</text>
</g>
```

---

## Text Link Pattern (44px tap target)

Text links MUST have an invisible tap target rect:

```xml
<!-- Link with 44px tap target -->
<g class="link">
  <!-- Invisible tap target (extends around text) -->
  <rect x="0" y="-10" width="120" height="44" rx="4" fill="transparent"/>
  <!-- Link text -->
  <text x="60" y="14" text-anchor="middle" class="link-text">Forgot password?</text>
</g>
```

---

## Action Link Pattern (e.g., "Revoke", "Delete", "Edit")

Small action links in lists/panels need proper tap targets:

```xml
<!-- Action link with 60x44 tap target -->
<g class="action-link">
  <!-- Tap target (minimum 44px height, width fits text + padding) -->
  <rect x="0" y="-10" width="60" height="44" rx="3" fill="transparent"/>
  <!-- Action text -->
  <text x="30" y="14" text-anchor="middle" class="danger-text">Revoke</text>
</g>
```

---

## Radio Button Pattern (44px tap target)

```xml
<!-- Radio with 44px tap target -->
<g class="radio-field">
  <!-- Invisible tap target -->
  <rect x="-14" y="-14" width="44" height="44" rx="22" fill="transparent"/>
  <!-- Visual radio (16x16 circle) -->
  <circle cx="8" cy="8" r="8" fill="none" stroke="#b8a080" stroke-width="2"/>
  <!-- Selected state (inner circle) -->
  <circle cx="8" cy="8" r="4" fill="#8b5cf6"/>
  <!-- Label -->
  <text x="24" y="13" class="text-sm">Option A</text>
</g>
```

---

## Toggle/Switch Pattern (44px tap target)

```xml
<!-- Toggle with 44px tap target -->
<g class="toggle-switch">
  <!-- Invisible tap target -->
  <rect x="-6" y="-10" width="60" height="44" rx="6" fill="transparent"/>
  <!-- Toggle track (48x24) -->
  <rect x="0" y="0" width="48" height="24" rx="12" fill="#8b5cf6"/>
  <!-- Toggle thumb (20x20) -->
  <circle cx="36" cy="12" r="10" fill="#ffffff"/>
</g>
```

---

## Icon Button Pattern (minimum 44x44)

```xml
<!-- Icon button at 44x44 minimum -->
<g class="icon-button">
  <rect x="0" y="0" width="44" height="44" rx="6" fill="#f5f0e6" stroke="#b8a080"/>
  <!-- Icon centered (example: close X) -->
  <text x="22" y="28" text-anchor="middle" font-size="18">✕</text>
</g>
```

---

## Nav Item Pattern (full-width, 44px height)

```xml
<!-- Active nav item -->
<g class="nav-item">
  <rect x="0" y="0" width="180" height="44" rx="6" fill="#8b5cf6"/>
  <text x="15" y="28" class="btn-text">Dashboard</text>
</g>

<!-- Inactive nav item -->
<g class="nav-item">
  <rect x="0" y="0" width="180" height="44" rx="6" fill="transparent"/>
  <text x="15" y="28" class="text-md">Settings</text>
</g>
```

---

## Summary: Minimum Tap Target Sizes

| Element              | Minimum Size                              | Pattern                 |
| -------------------- | ----------------------------------------- | ----------------------- |
| Checkbox             | 44×44 invisible rect around 16×16 visual  | Use checkbox pattern    |
| Radio                | 44×44 invisible rect around 16×16 visual  | Use radio pattern       |
| Text link            | 44px height × text width + 20px padding   | Use link pattern        |
| Action link          | 44×44 minimum, width fits text            | Use action link pattern |
| Icon button          | 44×44 visible button                      | Direct sizing           |
| Toggle               | 44px height × toggle width + 12px padding | Use toggle pattern      |
| Nav item             | Full width × 44px height                  | Direct sizing           |
| List item (tappable) | Full width × 44px minimum height          | Direct sizing           |

**ENFORCEMENT**: When generating ANY interactive element, check this table and use the correct pattern. Never create a tappable element smaller than 44×44px total tap area.
