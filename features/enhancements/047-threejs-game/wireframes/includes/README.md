# Wireframe Includes

Reusable wireframe components with build-time injection. Update header/footer once, regenerate wireframes to see changes.

## Architecture: Build-Time Injection

**Why not runtime `<use href>`?** Nested external SVG references don't work - browsers can't resolve `<use href="#symbol">` inside a cloned external group.

**Solution:** `/wireframe` reads these files and **injects content directly** into generated SVGs. Icons are inline paths, not symbol references.

## Files

| File                 | Description                               | Group ID               |
| -------------------- | ----------------------------------------- | ---------------------- |
| `defs.svg`           | Master icon library (reference only)      | N/A                    |
| `header-desktop.svg` | Desktop header (logo, nav, icons, avatar) | `#desktop-header`      |
| `header-mobile.svg`  | Mobile status bar + header                | `#mobile-header-group` |
| `footer-mobile.svg`  | Mobile bottom nav (4 tabs)                | `#mobile-bottom-nav`   |

## How It Works

1. `/wireframe` reads include files at generation time
2. Extracts content inside the `<g id="...">` group
3. Injects directly into the generated SVG
4. No external references at runtime

```
Include File                    Generated Wireframe
┌─────────────────────┐        ┌─────────────────────────────┐
│ <g id="desktop-     │   →    │ <!-- Desktop Header -->     │
│   header">          │  inject│ <g transform="translate()">│
│   <rect .../>       │        │   <rect .../>               │
│   <path .../>       │        │   <path .../>  ← inline     │
│ </g>                │        │ </g>                        │
└─────────────────────┘        └─────────────────────────────┘
```

## Updating Components

To update all wireframes with new header/footer:

1. Edit the include file (e.g., `header-desktop.svg`)
2. Run `/wireframe [feature]` to regenerate (or regenerate all)
3. Changes are embedded in the regenerated SVGs

This maintains a **single source of truth** while ensuring icons always render.

## Icons

All icons are inline `<path>` elements from Heroicons 24x24 solid. Icons embedded directly in include files - no `<use href>` to external files.

### Icon Reference (from defs.svg)

| Icon           | Use Case          |
| -------------- | ----------------- |
| `icon-cog`     | Settings gear     |
| `icon-eye`     | Accessibility     |
| `icon-home`    | Home nav          |
| `icon-bolt`    | Features          |
| `icon-doc`     | Docs              |
| `icon-user`    | Account/profile   |
| `icon-signal`  | Mobile status bar |
| `icon-battery` | Mobile status bar |
| `icon-menu`    | Hamburger menu    |

## Active States

Headers and footers have all items **inactive by default**. To set an active nav item, overlay after the include:

### Desktop Nav Active State

```xml
<!-- After injected desktop header, add active state overlay -->
<g transform="translate(600, 73)"> <!-- Position of nav-home -->
  <rect width="70" height="44" rx="4" fill="#8b5cf6"/>
  <text x="35" y="28" text-anchor="middle" fill="#fff" font-size="14px" font-weight="600">Home</text>
</g>
```

### Mobile Bottom Nav Active State

```xml
<!-- After injected mobile bottom nav, add active tab -->
<g transform="translate(x, y)">  <!-- Same position as bottom nav -->
  <rect width="85" height="56" fill="#8b5cf6"/>
  <g transform="translate(30, 6)">
    <path fill="#fff" d="..."/> <!-- Icon path with white fill -->
  </g>
  <text x="42" y="44" text-anchor="middle" fill="#fff" font-size="11" font-weight="600">Home</text>
</g>
```

## Colors Reference

| Color            | Hex       | Use                        |
| ---------------- | --------- | -------------------------- |
| Primary          | `#8b5cf6` | Brand, active states, CTAs |
| Dark text        | `#1a1a2e` | Headings, icons            |
| Body text        | `#374151` | Regular text               |
| Muted text       | `#4b5563` | Secondary text             |
| Parchment        | `#e8d4b8` | Main background            |
| Darker parchment | `#dcc8a8` | Headers, cards             |
| Border           | `#b8a080` | Strokes                    |
