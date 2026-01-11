# 02-privacy-settings.svg Issues

**SVG**: `docs/design/wireframes/002-cookie-consent/02-privacy-settings.svg`
**Reviewed**: 2026-01-10
**Status**: REGENERATE (structural issues)

---

## Issues Found

### Issue 1: Legend descriptions too terse
**Classification**: REGENERATE
**Lines**: 424-482

All requirement descriptions in REQUIREMENTS KEY are under 5 words:
- `FR-009: Persist prefs` (2 words)
- `FR-010: Settings page` (2 words)
- `FR-011: Footer link` (2 words)
- `FR-012: Immediate effect` (2 words)
- etc.

**Required**: Each description should be 15-50 words explaining what the requirement does, why it matters, and how users interact with it.

**Example fix**:
```
FR-009: Store user cookie preferences in localStorage with sessionStorage fallback, ensuring choices persist across browser sessions and page reloads
FR-010: Dedicated privacy settings page accessible via persistent footer link, allowing users to review and modify all consent choices at any time
```

**Reference**: G-015 (to be added)

---

### Issue 2: Legend-Signature collision
**Classification**: REGENERATE
**Lines**: 419, 487

- Legend at y=950, height=90px, bottom edge at y=1040
- Signature at y=1050
- Gap = 10px (too tight, may overlap visually)

**Required**: Minimum 20px gap between legend bottom and signature.

**Fix options**:
1. Move legend to y=920 (legend bottom = 1010, gap = 40px)
2. Move signature to y=1065 (gap = 25px)
3. Reduce legend height to 70px (bottom = 1020, gap = 30px)

**Reference**: G-011 (Content >= 50px from container edges)

---

### Issue 3: Mobile header manually redrawn
**Classification**: REGENERATE
**Lines**: 263-292

The mobile status bar and header are manually redrawn instead of using the include template.

**Current** (wrong):
```xml
<!-- MOBILE STATUS BAR -->
<g transform="translate(10, 10)">
  <rect width="340" height="28" rx="16" fill="#dcc8a8"/>
  <!-- ... manually drawn icons ... -->
</g>

<!-- MOBILE HEADER -->
<g transform="translate(10, 38)">
  <!-- ... manually drawn header ... -->
</g>
```

**Required**:
```xml
<use href="../includes/header-mobile.svg#mobile-header-group" x="10" y="10"/>
```

**Reference**: G-002, G-006

---

### Issue 4: Mobile footer manually redrawn
**Classification**: REGENERATE
**Lines**: 378-415

The mobile bottom nav is manually redrawn instead of using the include template.

**Current** (wrong):
```xml
<!-- MOBILE BOTTOM NAV -->
<g transform="translate(10, 634)">
  <!-- ... manually drawn bottom nav ... -->
</g>
```

**Required**:
```xml
<use href="../includes/footer-mobile.svg#mobile-footer-group" x="10" y="634"/>
```

**Reference**: G-002, G-006

---

## Summary

| # | Issue | Classification | Fix |
|---|-------|----------------|-----|
| 1 | Legend descriptions too terse | REGENERATE | Write 15-50 word descriptions |
| 2 | Legend-signature collision | REGENERATE | Move legend to y=920 or reduce height |
| 3 | Mobile header manually drawn | REGENERATE | Use `<use href>` include |
| 4 | Mobile footer manually drawn | REGENERATE | Use `<use href>` include |

**Verdict**: Full regeneration required. Too many structural issues to patch.
