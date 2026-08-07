# PRP — CoD Game Toolkit + Gauntlet-Loop Demo Generator

**Status:** Phase 2a (toolkit foundation) implemented on `spike/cod-walking-skeleton`;
Phase 2b (the generator skill) designed here, not yet built.
**Category:** enhancements · **Feature:** `features/enhancements/051-cod-game-toolkit/`
**Branch:** `spike/cod-walking-skeleton`

## Summary

Harvest Matt Shumer's MIT [Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty)
procedural primitives into a **reusable, asset-free R3F game toolkit** for the
ScriptHammer family, then build a **gauntlet-loop generator** that scaffolds a
playable game demo from a short spec. The toolkit is the "variable function"; each
game is a parameterization of it.

Nine slices (proven on Three r184) already harvested the primitives: physics
(swept-capsule + BVH), a procedural PBR material forge, an atmospheric sky + IBL,
procedural audio (surface-keyed footsteps), a GPU particle system, camera-feel
springs, a crouch/sprint/prone locomotion layer, and the two core gems (event bus +
quality tiers). All are 100% procedural — zero art/audio assets — which is exactly
what makes a browser 3D prototype hard, gift-wrapped.

## Why "harvest, not embed"

CoD runs its own imperative render loop + service-locator kernel; **R3F owns the
`<Canvas>` renderer and loop**. Two loops can't share one canvas, so we do not lift
the kernel — we vendor the framework-agnostic primitives under `src/lib/cod/` and
adapt each to R3F (materials bake off-screen; physics/particles tick in `useFrame`;
audio/springs are hooks; the OVERWATCH `ctx` becomes plain modules — an event bus,
a quality store, injected renderers). The kernel (engine/registry/prewarm/main) is
never vendored.

## Phase 2a — the packaged toolkit (this pass)

Public API: **`@/lib/cod`** (barrel). See `src/lib/cod/README.md`.

- **Core gems** (`src/lib/cod/core/`): `EventBus`/`bus` (game events without React
  re-renders; `on` returns an unsubscribe closure) and `QUALITY_PRESETS` +
  `useQuality()` (low/medium/high/ultra tiers; the renderer-generic fields only —
  CoD's post-chain flags dropped). Both typed TS, ported from `registry.js:86-122`
  and `config.js:21`.
- **Typed public surface**: a barrel (`index.ts`) + hand-written `.d.ts` for the
  primary classes (`CharacterController`, `StaticWorld`); the material/particle/sky
  classes are reached via the already-typed hooks.
- **Gems wired into the demo** (proof they're live, not dead): `useQuality` drives
  the Canvas `dpr` (`renderScale`), texture `anisotropy`, and the dust particle pool
  (`particleBudget`), with a HUD `<select>` + `?q=` param; `bus` carries the
  `player:stance` event from inside the `<Canvas>` to the outer HUD badge (no
  prop-drill) — the exact pattern generated game code will use.
- **Docs**: this PRP + `features/enhancements/051-cod-game-toolkit/`.

## Phase 2b — the gauntlet-loop `game-demo` generator (designed, not built)

A **net-new Claude Code skill** at `~/.claude/skills/game-demo/SKILL.md` (+ a
`references/` dir of subagent prompts, mirroring the `graphify` skill's shape). The
"gauntlet loop" (Matt Shumer's pattern: **Task → Build method: fan out subagents,
each with a blind critic → Bar: don't stop until every critic is wowed**) applied to
game scaffolding.

**Input:** a short game-spec — genre, theme, core mechanic, look — e.g. *"a
top-down survival-automation game on a dead-earth farm, darkly satirical."*

**Orchestration:**
1. **Plan** — one agent turns the spec into a build-list of independent pieces
   (level/world, player mechanics, entities/AI, HUD/UI, audio-visual feel), each
   expressed against the `@/lib/cod` public API.
2. **Fan out** — one builder subagent per piece (dispatched in a single message for
   parallelism), each paired with a **blind critic** that scores its output against
   the spec + a quality bar; loop the pair until the critic is satisfied.
3. **Scaffold** — builders drive **`plop component`** (the repo's 5-file generator,
   `game` category → `Features/Game/*`) for components, and hand-author one
   `'use client'` `ssr:false` `page.tsx` route (the `/game/3d` + `/game/cod-skeleton`
   pattern). No hand-rolled partial components — plop guarantees the 5-file CI gate.
4. **Verify + iterate** — run `tsc` + `vitest` + `validate:structure` + a Playwright
   smoke of the new route; feed failures back into the loop.

**Repo constraints the generator MUST honor** (from `CLAUDE.md` + recon):
- **Static export** — no `src/app/api/` / server routes; R3F components are
  `ssr:false` dynamic imports; browser env only `NEXT_PUBLIC_*`.
- **Docker-first** — all commands as `docker compose exec scripthammer pnpm …`.
- **5-file component CI gate** (`validate-structure.js`) — always via plop.
- **Canvas a11y carve-out** — the `FallbackPanel` + WebGL-probe pattern, a Pa11y
  exclusion, and a documented manual-a11y rationale (axe can't audit canvas).
- Only optional **save/share** of a generated demo would touch Supabase; the toolkit
  + prototype layer is 100% client-side.

**Deliverable of 2b:** the skill + at least one generated, verified playable demo
route, produced end-to-end from a spec.

## Not in scope

Vendoring CoD's kernel; the FPS app layer (weapons/ai/world/ui — a reference for a
milsim fork, not the toolkit); full `.d.ts` for the material/particle/sky classes;
the SpecKit `spec/plan/tasks` for this feature (run `/specify` to generate them the
idiomatic way).

## References

- Toolkit README: `src/lib/cod/README.md`
- Extraction map: `features/enhancements/051-cod-game-toolkit/research.md`
- Gauntlet-loop technique (source): the RoboNuggets transcript in the TranScripts
  repo, `Claude/Claude_Edited/gauntlet_loop_claude_prompting_subagents_robonuggets.md`
- CoD: https://github.com/mshumer/Claude-of-Duty (MIT)
