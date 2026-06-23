# Design-sync bundle generator

Generates a [Claude Design](https://claude.ai/design) **design-system** bundle from
ScriptHammer's real DaisyUI components and brand themes, then you push it with Claude
Code's `/design-sync`.

## What this is (and isn't)

`/design-sync` does **not** publish an npm package or upload your `.tsx` source. It
uploads **self-contained preview HTML cards** into a claude.ai design-system project.
Each card's first line is a marker comment — `<!-- @dsCard group="Buttons" -->` — and
the Design System pane compiles those markers into its card index automatically.

ScriptHammer's atomic/presentational components style purely from DaisyUI classes +
the two brand themes (`scripthammer-dark`, `scripthammer-light`). So each card just
needs the brand CSS attached and the real DaisyUI class markup — no hand-written CSS,
full fidelity.

## Files

| File           | Role                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.js`  | Curated component list. Each entry's class strings are copied **verbatim** from the component source (e.g. `Button.tsx`'s `variantClasses`/`sizeClasses`) so cards stay faithful. Add a component here. |
| `gen-theme.js` | Compiles `theme.css` — `@tailwindcss/postcss` + DaisyUI scoped to the two brand themes only (the 32 stock themes are omitted). Reads `classes.txt` as the safelist.                                     |
| `gen-cards.js` | Emits the `@dsCard` HTML. `--classes` writes the safelist; no arg emits cards with `theme.css` inlined, rendered **side-by-side dark + light**.                                                         |
| `build.js`     | One-command orchestrator: classes → theme → cards into an output dir.                                                                                                                                   |

## Build (Docker-first — required)

`@tailwindcss/postcss` + DaisyUI live in the container, so the build runs there:

```bash
docker compose exec -w /app scripthammer node scripts/design-sync/build.js
```

Output defaults to `/tmp/ds-bundle` **inside the container** (it's a build artifact,
not source — nothing is written into the repo). To get it onto the host, either copy
it out:

```bash
docker compose cp scripthammer:/tmp/ds-bundle ./ds-bundle
```

…or point `DS_OUT` at a path under the repo (which is bind-mounted at `/app`) — but
remember to keep it out of git:

```bash
DS_OUT=/app/.ds-bundle docker compose exec -w /app scripthammer \
  node scripts/design-sync/build.js
```

## Push to claude.ai

From Claude Code, in this repo:

```
/design-sync
```

It will `list_projects` (first run grants design scope), `create_project "ScriptHammer"`
if none exists, `finalize_plan`, then `write_files` from the bundle dir. Re-running with
an existing project updates it incrementally — one component at a time is fine.

Plan paths to finalize: `theme.css`, `tokens/**`, `components/**/*.html`.

## Adding a component

1. Open the component's `.tsx`, copy its variant/size class maps verbatim.
2. Add a `render()` function + a manifest entry in `manifest.js` (pick a `group`).
3. Rebuild and eyeball before pushing:

```bash
docker compose exec -w /app scripthammer node scripts/design-sync/build.js
# screenshot a card to confirm it renders (OKLCH resolves, dark ≠ light):
docker compose exec scripthammer chromium --headless --no-sandbox \
  --screenshot=/tmp/shot.png "file:///tmp/ds-bundle/components/<slug>/index.html"
```

## Scope

Synced: design tokens (colors, shape, typography) + the portable atomic/presentational
tier. **Excluded:** components whose visual output is state/data-driven (auth, payment,
admin, map, game, and anything importing `@/contexts`, `@/services`, fetching hooks, or
canvas/3D) — they have no honest static preview.

## Note on DaisyUI v5 drift

DaisyUI 5 (beta) renamed/removed several v4 classes the app still uses:
`card-bordered`→`card-border`, `card-compact`→`card-sm`, and `input-bordered` /
`form-control` / `label-text` were removed (the base `.input` is bordered; v5 uses
`.fieldset` + `.label`). The manifest uses the **v5** names so cards render correctly.
The app components still carry the v4 names (dead classes — harmless, but worth a future
cleanup pass).
