# Authoring As-Is Wireframes

Conventions for producing wireframes that mirror what ships today at a route.
Distinct from aspirational wireframes (which design future features).

## Filename

`features/<category>/<NNN-feature>/wireframes/as-is-<route-slug>.svg`

Slug derivation (deterministic):

- Strip leading `/`; replace remaining `/` with `-`.
- `/` → `root`.
- Dynamic segments `[slug]` → `slug`, `[tag]` → `tag`.

Examples:

- `/` → `as-is-root.svg`
- `/sign-in` → `as-is-sign-in.svg`
- `/blog/[slug]` → `as-is-blog-slug.svg`
- `/admin/payments` → `as-is-admin-payments.svg`

## The four rules

1. **Never invent UI.** Read the route's `page.tsx` (and 1–2 key imported
   components) before authoring. Quote real labels, real button copy, real
   nav items directly from the source. If the real page has a "Sign in"
   button, the wireframe says "Sign in" — not "Login" or "Continue."

2. **Mid-fidelity, not pixel-perfect.** Use the shared light theme palette
   (`#e8d4b8` panels, `#8b5cf6` primary, `#c7ddf5→#b8d4f0` gradient). Don't
   try to replicate exact DaisyUI theme CSS. The goal is "a forker
   recognizes this as the real page" — not "this is a screenshot."

3. **Chrome via `<use href>` includes.** Do NOT inline header/footer
   rectangles. Use:

   ```xml
   <use href="includes/header-desktop.svg#desktop-header" x="0" y="0"/>
   <use href="includes/footer-desktop.svg#site-footer"   x="0" y="640"/>
   <use href="includes/header-mobile.svg#mobile-header-group" x="0" y="0"/>
   <use href="includes/footer-mobile.svg#mobile-bottom-nav"  x="0" y="664"/>
   ```

   Then overlay a single purple `<rect>` + white `<text>` on the desktop
   header marking the active nav slot for the current route:
   - Home: `x=400, y=3, w=70`
   - Features: `x=480, y=3, w=90`
   - Docs: `x=580, y=3, w=70`
   - Account: `x=660, y=3, w=80`

4. **Signature uses `999:NN` namespace.** Format:
   `999:<idx> | <route-title> (as-is /<route>) | ScriptHammer`
   Where `<idx>` is the zero-padded route index from `scripts/route-feature-map.json`.
   `999` is outside the 000–046 feature range so it reads as the as-is namespace.

## Canvas layout

Identical to aspirational wireframes:

- `viewBox="0 0 1920 1080" width="1920" height="1080"`
- Desktop mockup: `<g transform="translate(40, 60)">` with 1280×720 panel
- Mobile mockup: `<g transform="translate(1360, 60)">` with 360×720 panel
- Annotation panel: `<g transform="translate(40, 800)">` with 1840×220 panel
- Signature: `<text x="40" y="1060" font-size="18" font-weight="bold" fill="#374151">`

## Annotations

As-is wireframes describe what ships, not a spec. Use the annotation panel
to call out **at least 4** visible elements (ANN-002 enforces `>=4` callouts):

- **Title + brief description** — what the element is and does in real app.
- **US- badge pill per callout group** — validator (US-001) requires every
  annotation group to be US-anchored. As-is wireframes don't have a real
  spec-backed US, so use a synthetic US number matching the route's
  responsibility (e.g. `US-001` = primary content, `US-002` = interaction,
  `US-003` = output). Reference: `as-is-accessibility.svg` uses US-001
  through US-005 for its 5 annotation groups.
- Optional FR/SC badges for cross-referencing real spec items if the as-is
  route traces cleanly to aspirational spec requirements.
- Callout circles appear on the SVG itself (numbered red circles over the
  page elements), and the corresponding numbered callout group appears in
  the annotation panel with the US badge + narrative.

## Validation

Every as-is SVG must pass the shared validator:

```bash
docker compose exec scripthammer \
  python3 .specify/extensions/wireframe/scripts/validate.py \
  features/<cat>/<feat>/wireframes/as-is-<slug>.svg
```

Common failure modes:

- **FONT-001 (font < 14px):** bump all text to 14+; titles 16+; section labels 14 with `letter-spacing:1`.
- **HDR-001 (missing includes):** use the four `<use href>` calls above.
- **G-025 (missing signature):** add the `999:NN` signature at y=1060.
- **COLL-001 (callout near footer):** keep callouts above y=620 on desktop, y=620 on mobile.
- **ANN-001 (missing annotation panel):** include `<g id="annotations">` with the 1840×220 rect.

## Reference implementation

`features/enhancements/018-font-switcher/wireframes/as-is-accessibility.svg`
is the canonical example. When in doubt, structure new SVGs like it.

## Per-batch workflow (for Claude or humans)

1. Read each route's `page.tsx` in parallel.
2. Sketch the visible sections in your head (header → page h1 → cards/form → preview → footer).
3. Pick 4–6 callouts.
4. Author the SVG following this doc.
5. Run the validator; fix inline.
6. Move on to the next route.
