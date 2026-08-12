# Brand marks — provenance

## What is original, and what is ours

**`*.svg` in this directory are the Claude Design exports, byte-identical to the zip.** Verified against `ScriptHammer visual refresh (2).zip` → `export/`, SHA-256 matched on all four plus `README.txt`. They are never edited. Keeping them intact is what lets anyone diff our composition against the designer's.

**`rebalanced/*.svg` are ours**, generated from the exports by `tools/rebalance.py`. That script is the diff, expressed as code — every substitution is asserted, so a silent no-match cannot ship a half-applied change.

**`public/*.svg` are derived from `rebalanced/`**, and the 19 icons are derived from `public/favicon.svg` by `scripts/generate-icons.js`.

```
export (pristine) ──► tools/rebalance.py ──► rebalanced/ ──► public/ ──► 19 icons
                                                     └──► outline-ring-text.py ──► wordmark ──► ringWordmark.ts
```

## Why we diverged from the export

The export is the designer's drawing; the composition is ours, and we changed it twice on purpose.

### 1. Rebalanced — the name is Script + Hammer, not gear

"ScriptHammer" is **Script** (the `< >` brackets) and **Hammer** (the mallet). The gear is in neither. The export gave the gear 95% of the canvas with a 30%-thick band and left the two things the name refers to at 41% and 27%.

This was not a new opinion. `docs/design/2a/ScriptHammer-Directions.dc.html:98-100` already specified the hero as gear 308px / brackets 192px / mallet 128px — **brackets 0.505 and mallet 0.368 of the gear** once corrected for each file's ink-to-box ratio. The component shipped 0.42 and 0.249. The brackets were ~20% undersized and the mallet ~48% undersized against the design of record. The Three.js scene had independently drifted the same way, rendering them at 0.65 and 0.70.

| | export | now |
|---|---|---|
| tooth tip radius | 196 | 188 |
| body / root radius | 155 | 167 |
| inner hole radius | 96 | 122 |
| tooth depth | 41u | **21u** |
| ring band | 59u | 45u |
| brackets | `scale(.52)` | **`scale(.68)`** |
| mallet | `scale(.28)` | **`scale(.46)`** |
| ring wordmark | r108 | r129.129, **font-size 38 unchanged** |

The band was **widened** rather than thinned, which looks backwards until you see why: `textLength="300"` is fixed, and the squeeze `k = textLength / natural_advance` scales with font-size. At F=38, `k = 0.90671` — a 9.3% squeeze. Drop to F=32 and `k` inverts to **1.077**, a 7.7% *stretch* on a face that is already condensed. Holding F=38 keeps every `scale(0.034455 -0.038000)` in the baked glyph table byte-identical; only the on-arc positions move.

Teeth are reparameterised by **tangential half-width**, not half-angle. Holding the angles while shrinking the radius splays the flanks to 12.9° off radial and the teeth read as a ratchet. `tools/gear-path.py` reproduces the committed export path **exactly** with the original parameters — that equality is the regression test, and it runs before any new geometry is emitted.

### 2. Comic-inked — the fills cannot survive a light ground

The brand palette is fixed and does not follow the theme (see `README.txt`). Measured against `#ffffff`:

```
beech top   #E6CB99   1.57:1
steel face  #B6BEC6   1.88:1
brass lit   #EBB042   1.94:1
sparks      #FFE9A8   1.20:1
```

Ten of the 35 themes are pure `#ffffff` and `base-100` spans the full gamut to `#000000`. The mark dissolved on light themes. A dark keyline in the brand's own `#2E353B` gives it definition that does not depend on fill-versus-ground: **12.44:1 on white**.

It is inert on the 15 dark themes (1.06:1 on `dim`, 1.15:1 on `aqua`, 1.37:1 on the fixed `#1a1a2e` icon tiles) — acceptable, because there the fills already carry ~9:1. **The internal plane separations are the part that works on all 35 themes**, because they separate shape from shape rather than shape from ground. That is the argument for inking every plane rather than only the silhouette.

Keyline weights are pre-divided by each group's scale (`KEYLINE / 0.68`, `KEYLINE / 0.46`) because `stroke-width` scales with the transform. Quoting one number in all three places would produce three different line weights.

### The clear-space halo was deleted, not retuned

`<mask id="cut-lockup">` knocked the gear and brackets out from behind the mallet. Its stated purpose was *"keeps the mallet readable against the gear teeth"* — but after the rebalance the mallet's max radius is **81.67** inside a hole of **122**, so it never reaches them. All it still did was carve a white channel through the brackets.

The keyline replaces it: an outline, not an eraser. The mallet simply overlaps the brackets and the ink separates them, which is how comic art has always handled overlap.

## This is a legibility decision, not a compliance one

Nothing in this repo gates the mark, and it is worth being explicit so nobody "fixes" it back citing a rule:

- The mark renders `aria-hidden` with no text nodes, so axe skips it entirely.
- `tests/e2e/color-contrast.spec.ts` runs only `color-contrast-enhanced` (text-only) across **2 of 35 themes**.
- `config/pa11yci.json` disables both contrast rules outright.
- **WCAG 1.4.3 and 1.4.11 both exempt logotypes** — "text that is part of a logo or brand name has no minimum contrast requirement".
- This repo's own requirements (`features/foundation/001-wcag-aa-compliance/spec.md:234-236`) cover text only. WCAG 1.4.11 is not adopted here at all.

The mark was never failing anything. It just looked bad on a white page, and that was reason enough.

## Regenerating

Order matters; two steps fail **silently**.

1. `python3 tools/rebalance.py` → `rebalanced/*.svg` (asserts its own substitutions; `gear-path.py` asserts its regression first)
2. Re-extract the glyph layout from the **new** lockup in Chromium with Oswald 700 loaded — *skip this and the wordmark bakes onto the old arc with no error*
3. `python3 tools/outline-ring-text.py` → `public/scripthammer-wordmark.svg` (reads the diamonds from its source, so it can no longer re-emit stale ones)
4. Re-derive `public/favicon.svg` and `public/scripthammer-logo.svg` — drop the `cut-word` mask, the ring guides, and the `mask=` on the steel gear. Validate the XML immediately; a malformed attribute here only surfaces when `sharp` rasterises it three steps later.
5. `pnpm run generate:icons` → 19 assets *(loud — `check:icons` fails CI)*
6. Rebuild `opengraph-image.png` and `apple-icon.png` from the wordmark

`scripts/__tests__/manifest-assets.test.js` holds two guards: no shipped brand SVG may carry live text, and the inline component must draw the same mark as `public/favicon.svg`. The second exists because those are two independent render paths with no shared source — inking one and not the other ships a different logo in the browser tab than on the page.

## Font

Oswald (SIL OFL 1.1), from `google/fonts` `ofl/oswald`, instanced at `wght=700` with `fonttools varLib.instancer`. Needed **only** to bake the ring wordmark; nothing shipped depends on it at runtime.

`export/README.txt` says to outline the ring text in Illustrator/Figma/Inkscape. **Inkscape 1.2.2 does not work** — it converts the letterforms but discards the `textPath` placement, collapsing all 32 glyphs to their local origin off-canvas. Measured against a Chromium+Oswald render it scored *worse than having no font at all* (7.14% vs 5.51% differing pixels). `tools/outline-ring-text.py` instead takes the on-path position and tangent from Chromium, which has already honoured `textLength` and `lengthAdjust`, and the outlines from fontTools: **1.372% differing, 0.682% strong**, all of it a ~1px antialiasing hairline.

## Known divergence, not fixed here

`src/components/game/CogRing/CogRing.tsx` hand-ports a **20-tooth** gear with rivets from the pre-v3 brand. The shipping art has **12 teeth and no rivets**. The `features/enhancements/047-threejs-game/` spec, plan, tasks and two wireframes all pin the wrong number. This work widens that gap; it did not create it.
