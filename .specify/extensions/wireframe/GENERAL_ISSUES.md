# Wireframe authoring — recurring issues

Cross-feature lessons, so the same mistake is not rediscovered per feature.
`/speckit.wireframe.prep` reads this file; it did not exist until 2026-08-06, which is why
several of the entries below had to be relearned from the validator's error messages.

**Promotion rule:** a pattern seen in ≥3 features' `*.issues.md` belongs here. Entries found
during first authoring of a feature also belong here if they are structural rather than
specific to one screen.

---

## The colour pair everyone gets backwards

`#e8d4b8` is the **viewport frame**. `#dcc8a8` is the **annotation panel, cards and chrome**.

The validator names `#e8d4b8` `panel_bg`, which reads as "the panel colour" and is why the
mistake is easy — and `wireframe-config.yml` reinforces it by saying "panels `#e8d4b8`".
Swapping them fails validation.

Three traps in the same area:

- **`#e8d4b8` is in `faded_colors` and must never be a button fill.** It is legal as button
  _label text_ on a `#8b5cf6` face, which is what the reference does.
- **A mobile frame may not be dark.** `FORBIDDEN_FRAME_COLORS = ['#1f2937','#111827','#0f172a']`.
  Note `#1f2937` is fine as _text_ fill — the rule is about frame fills.
- **Toggle heuristic.** A toggle-shaped rect must be `#6b7280` (off) or `#22c55e` (on).
  Feature 048 was forced into a full regeneration because its requirement chips matched the
  toggle shape. Keeping badge pills at **56×22 rx=11** stays outside the heuristic — 40–55
  wide × 20–29 tall with `rx>=10` is the trap window.

## Callouts

- **Desktop `cy + r < 610`; mobile `cy + r < 634`.** A callout at cy=596 with r=14 lands on
  exactly 610 and fails — the comparison is strict.
- **A callout may not sit on top of a button.** Place it right of, or below, the control.
- **On mobile, centred callouts almost always fail.** The viewport is 360 wide and most
  controls are full-bleed, so `cx=180` lands inside something. **Use the right gutter at
  `cx=332`**, which clears anything ending at x≤321.
- Mobile reuses desktop callout numbers; it does not need all of them.

## Prose in annotations is parsed as XML

Writing `utm_content=order_id` inside a `<text>` element fails `XML-004` — the attribute
regex reads it as an unquoted attribute. **Avoid bare `word=word` in annotation copy.**
Rephrase ("the order id as utm_content") rather than quoting it.

## User-story coverage is per file, not per feature

`US-002` requires **≥3 distinct `US-\d{3}`** in the annotation region of _each_ SVG. A screen
that genuinely serves only one or two stories still needs a third.

Resist padding. There is usually a real one: an admin queue that shows a booking status is
legitimately covered by the booking story; a tip jar whose fee-free methods produce no order
record legitimately touches the operator story.

## Forbidden words in annotation text

`Legend:`, `Coverage:`, `Integration:`, `UI Elements`, `Summary`, `Notes`, `modal`, `dialog`,
`consent`. The last three matter for commerce and privacy screens — write "permission card"
or "privacy choice" instead of "consent", and describe an overlay by what it does.

## `includes/` must be copied once per feature

`scripts/sync-wireframes.sh` only mirrors an _already-existing_ per-feature `includes/`
out to `public/`, guarded by `if [ -d "$wf_dir/includes" ]` with a `|| true`. It never
creates source files under `features/`.

If the directory is missing the guard silently skips, `public/wireframes/<slug>/includes/` is
never created, and every `<use href="includes/…">` 404s in the viewer with nothing reporting
it. **Copy `includes/` manually** from
`features/foundation/003-user-authentication/wireframes/includes/` when starting a feature's
first wireframe. `wireframe-config.yml` records the same setup requirement.

Unnoticed for a long time because every existing feature dir already carried a byte-identical
copy; feature 050 was the first to hit the empty case.

## Ordering and structure

- The `<?xml?>`, `<svg>`, gradient, background rect and title/DESKTOP/MOBILE labels must come
  **before any group** — `G-024` and `SECTION-001` scan only the first 2000 characters.
- Mobile's first content element after the header `<use>` needs `y >= 78`. The header `<use>`
  must be **self-closing**, or the check silently skips.
- Mockup red-circle count must be **≥** annotation red-circle count.
- `#6b7280` is forbidden as a `<text>` fill anywhere after `id="annotations"` — and the
  signature sits inside that window.

## Iterating

Validate with `--json`. The default mode writes `.issues.md` files, which you do not want
while still fixing errors.

The validator takes a file or `--all`, **not a directory** — passing one raises
`IsADirectoryError`.
