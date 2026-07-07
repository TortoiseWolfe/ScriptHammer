# Custom Theme Guide

How to create a branded DaisyUI theme for your fork of ScriptHammer.

## Quick Start

After running `scripts/rebrand.sh`, your `src/app/globals.css` will contain placeholder theme blocks named `yourproject-dark` and `yourproject-light`. Edit the oklch color values to match your brand.

## Theme Syntax

ScriptHammer uses DaisyUI v5 with Tailwind v4's CSS-first configuration. Custom themes are defined using `@plugin "daisyui/theme"` blocks in `src/app/globals.css`.

### Minimal Example

```css
@plugin "daisyui/theme" {
  name: 'myproject-dark';
  default: true;
  prefersdark: true;
  color-scheme: dark;

  --color-base-100: oklch(22.84% 0.038 282.93);
  --color-base-200: oklch(21.13% 0.039 282.53);
  --color-base-300: oklch(28.51% 0.067 281.32);
  --color-base-content: oklch(92.88% 0.013 255.51);

  --color-primary: oklch(76.05% 0.024 258.37);
  --color-primary-content: oklch(22.84% 0.038 282.93);

  --color-secondary: oklch(87.91% 0.043 76.31);
  --color-secondary-content: oklch(22.84% 0.038 282.93);

  --color-accent: oklch(75.35% 0.139 232.66);
  --color-accent-content: oklch(22.84% 0.038 282.93);

  --color-neutral: oklch(31.14% 0.052 282.99);
  --color-neutral-content: oklch(87.17% 0.009 258.34);

  --color-info: oklch(62.31% 0.188 259.81);
  --color-info-content: oklch(96% 0.018 272.31);
  --color-success: oklch(72.27% 0.192 149.58);
  --color-success-content: oklch(22.84% 0.038 282.93);
  --color-warning: oklch(90.52% 0.166 98.11);
  --color-warning-content: oklch(22.84% 0.038 282.93);
  --color-error: oklch(63.68% 0.208 25.33);
  --color-error-content: oklch(96% 0.018 272.31);

  --radius-selector: 0.5rem;
  --radius-field: 0.25rem;
  --radius-box: 0.75rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}
```

### Required Properties

| Property                    | Purpose                | Dark theme guidance                | Light theme guidance                 |
| --------------------------- | ---------------------- | ---------------------------------- | ------------------------------------ |
| `--color-base-100`          | Primary surface        | Dark background (e.g., near-black) | Light background (e.g., off-white)   |
| `--color-base-200`          | Secondary surface      | Slightly darker than base-100      | Slightly darker than base-100        |
| `--color-base-300`          | Borders/dividers       | Lighter than base-100              | Darker than base-100                 |
| `--color-base-content`      | Default text           | Light text on dark surface         | Dark text on light surface           |
| `--color-primary`           | Brand identity color   | Your primary brand color           | Darker variant for light bg contrast |
| `--color-primary-content`   | Text on primary        | Contrasts against primary          | Contrasts against primary            |
| `--color-secondary`         | Supporting brand color | Your secondary brand color         | Darker variant for light bg          |
| `--color-secondary-content` | Text on secondary      | Contrasts against secondary        | Contrasts against secondary          |
| `--color-accent`            | Call-to-action/links   | Bright, attention-grabbing         | Darker variant for readability       |
| `--color-accent-content`    | Text on accent         | Contrasts against accent           | Contrasts against accent             |
| `--color-neutral`           | Muted UI elements      | Dark muted tone                    | Dark muted tone                      |
| `--color-neutral-content`   | Text on neutral        | Light text                         | Light text                           |
| `--color-info`              | Info alerts            | Blue-ish                           | Darker blue                          |
| `--color-success`           | Success states         | Green-ish                          | Darker green                         |
| `--color-warning`           | Warnings               | Yellow-ish                         | Darker yellow                        |
| `--color-error`             | Errors                 | Red-ish                            | Darker red                           |

Each semantic color has a `-content` variant for text rendered on top of that color.

### Shape and Effect Properties

| Property            | Default   | Purpose                                 |
| ------------------- | --------- | --------------------------------------- |
| `--radius-selector` | `0.5rem`  | Border radius for toggle/checkbox/radio |
| `--radius-field`    | `0.25rem` | Border radius for inputs                |
| `--radius-box`      | `0.75rem` | Border radius for cards/modals          |
| `--size-selector`   | `0.25rem` | Size of toggle/checkbox indicators      |
| `--size-field`      | `0.25rem` | Padding inside input fields             |
| `--border`          | `1px`     | Default border width                    |
| `--depth`           | `1`       | Shadow intensity (0 = flat)             |
| `--noise`           | `0`       | Background noise texture (0 = none)     |

## Color Format: oklch

DaisyUI v5 uses oklch (Oklab Lightness Chroma Hue) color values. To convert hex to oklch:

```javascript
// Run in Node.js or browser console
function hexToOklch(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // sRGB to linear
  const toLinear = (c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r),
    lg = toLinear(g),
    lb = toLinear(b);

  // Linear RGB to Oklab
  const l_ = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  );
  const m_ = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  );
  const s_ = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  );

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bv * bv);
  const H = ((Math.atan2(bv, a) * 180) / Math.PI + 360) % 360;

  return `oklch(${(L * 100).toFixed(2)}% ${C.toFixed(3)} ${H.toFixed(2)})`;
}

// Example: hexToOklch('#1a1a2e') → 'oklch(22.84% 0.038 282.93)'
```

Alternatively, use the browser DevTools color picker which shows oklch values directly.

## Registration

After defining your theme blocks, register them in the `@plugin "daisyui"` block at the top of `globals.css`:

```css
@plugin "daisyui" {
  themes:
    myproject-dark --default --prefersdark,
    myproject-light,
    light,
    dark,
    /* ... other DaisyUI built-in themes */;
}
```

- `--default` marks the theme loaded on first visit
- `--prefersdark` marks the theme used when the user's OS prefers dark mode

## Other Files to Update

### ThemeScript.tsx

Update the system theme fallback in `src/components/ThemeScript.tsx`:

```javascript
// Change these two return values:
return 'myproject-dark'; // was 'scripthammer-dark'
return 'myproject-light'; // was 'scripthammer-light'
```

### Storybook Preview

In `.storybook/preview.tsx`, add your themes to the switcher and set the default:

```typescript
themes: {
  'myproject-dark': 'myproject-dark',
  'myproject-light': 'myproject-light',
  // ... other themes
},
defaultTheme: 'myproject-dark',
```

### PWA Manifest

In `src/config/project.config.ts`, update theme and background colors to match your dark theme's base-100:

```typescript
theme_color: '#your-base-100-hex',
background_color: '#your-base-100-hex',
```

### Map Controls (if using Leaflet/MapLibre)

If your project includes map features, add your dark theme to the Leaflet control selectors in `globals.css`:

```css
[data-theme='myproject-dark'] .leaflet-control,
[data-theme='dark'] .leaflet-control,
/* ... */
```

## WCAG AA Contrast Requirements

All text must meet WCAG 2.1 AA minimum contrast ratios:

| Element                            | Ratio | How to check                      |
| ---------------------------------- | ----- | --------------------------------- |
| Normal text (< 18px)               | 4.5:1 | `base-content` against `base-100` |
| Large text (>= 18px bold)          | 3:1   | Headings against surfaces         |
| UI components                      | 3:1   | Borders, icons, form controls     |
| `primary-content` on `primary`     | 4.5:1 | Button text                       |
| `secondary-content` on `secondary` | 4.5:1 | Badge text                        |
| `accent-content` on `accent`       | 4.5:1 | Link hover states                 |

Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) or Storybook's a11y addon to verify.

## Verification

After defining your themes:

```bash
# Type-check (catches syntax errors in CSS)
docker compose exec <project> pnpm run type-check

# Storybook build (renders all components with your theme)
docker compose exec <project> pnpm run build-storybook

# Visual check in Storybook
docker compose exec <project> pnpm run storybook
# Switch themes using the toolbar dropdown
```
