# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This folder contains **46 feature specifications** (PRPs) for ScriptHammer, ready for the SpecKit workflow.

## Folder Structure

```
features/
├── foundation/       (000-006) RLS, Auth, a11y, security, template
├── core-features/    (007-012) Messaging, blog, accounts
├── auth-oauth/       (013-016) OAuth UX improvements
├── enhancements/     (017-021) PWA, analytics, maps
├── integrations/     (022-026) Forms, payments, sidebar
├── polish/           (027-030) UX refinements
├── testing/          (031-037) Unit & E2E tests
├── payments/         (038-043) Payment features
└── code-quality/     (044-045) Error handling, themes
```

## File Naming Convention

**Input** (authored content): `[###]_[name]_feature.md`
**Output** (SpecKit generates): `spec.md`, `plan.md`, `tasks.md`, `checklist.md`

## SpecKit Workflow (Required Sequence)

Execute these commands **in order** - do not skip steps:

```bash
# Phase 1: Specification
/speckit.specify                 # 1. Generate spec.md from *_feature.md
/speckit.clarify                 # 2. Refine requirements interactively
/speckit.wireframe.prep          # 3. Load spec + validator context
/speckit.wireframe.generate      # 4. Generate SVG wireframes (1920x1080)

# Phase 2: Wireframe Review (MANDATORY GATE)
/speckit.wireframe.review        # 5. Classify issues PATCH/REGEN; sign off into spec.md
/speckit.wireframe.generate      # 6. Regenerate flagged SVGs; re-review
# REPEAT until all wireframes PASS

# Phase 3: Implementation (BLOCKED until Phase 2 complete)
/speckit.plan                    # 7. Generate plan.md
/speckit.checklist               # 8. Generate checklist.md
/speckit.tasks                   # 9. Generate tasks.md
/speckit.analyze                 # 10. Cross-artifact consistency check
/speckit.implement               # 11. Execute implementation
```

**All steps are mandatory.** Phase 3 is blocked until wireframes pass review.
On sign-off, `/speckit.wireframe.review` writes approved wireframe paths
into `spec.md` under `## UI Mockup` — plan/tasks/implement then load those
wireframes as spec constraints.

## Wireframe Layout

Wireframes live inside each feature dir alongside spec.md:

```
features/<category>/<NNN-name>/
├── spec.md
├── plan.md
├── tasks.md
├── checklist.md
└── wireframes/
    ├── 01-<screen-name>.svg           # SVG wireframes (1920×1080)
    ├── 01-<screen-name>.issues.md     # Review findings (audit trail)
    ├── 02-<screen-name>.svg
    └── includes/                       # Shared chrome (header/footer)
        ├── header-desktop.svg
        ├── footer-desktop.svg
        ├── header-mobile.svg
        └── footer-mobile.svg
```

The Next.js app's `/wireframes` route auto-discovers every SVG via the
extension's manifest-driven viewer. Run `pnpm run dev` or `pnpm run build`
to refresh the viewer's manifest from `scripts/sync-wireframes.sh`.

## Wireframe Review Process

**Key Insight**: Patching structural issues makes things WORSE. Only patch cosmetic issues.

| Issue Type           | Classification | Action                                             |
| -------------------- | -------------- | -------------------------------------------------- |
| Wrong color value    | 🟢 PATCH       | `/speckit.wireframe.generate` patches in place     |
| Typo in text         | 🟢 PATCH       | `/speckit.wireframe.generate` patches in place     |
| Font size wrong      | 🟢 PATCH       | `/speckit.wireframe.generate` patches in place     |
| Badge placement      | 🟢 PATCH       | `/speckit.wireframe.generate` patches in place     |
| Layout problems      | 🔴 REGENERATE  | `/speckit.wireframe.generate` regenerates full SVG |
| Spacing issues       | 🔴 REGENERATE  | `/speckit.wireframe.generate` regenerates full SVG |
| Overlapping elements | 🔴 REGENERATE  | `/speckit.wireframe.generate` regenerates full SVG |
| Missing sections     | 🔴 REGENERATE  | `/speckit.wireframe.generate` regenerates full SVG |

If ANY issue on an SVG classifies as REGEN, regenerate the whole SVG.
Don't mix-and-match patches with regen findings.

### Issue Files

- `features/<cat>/<NNN-name>/wireframes/<svg-name>.issues.md` — audit trail
  per SVG. `/speckit.wireframe.review` writes findings here; never delete
  these files, they're the historical record of what was flagged and when.
- Machine validation: `.specify/extensions/wireframe/scripts/validate.py`
  runs 40+ structural + visual + coverage rules. Invoked automatically
  by `/speckit.wireframe.review`, or manually:
  `docker compose exec scripthammer python3 .specify/extensions/wireframe/scripts/validate.py --all --summary`

## Feature File Format (PRP Structure)

1. **Product Requirements** - What, why, success criteria, out of scope
2. **Context & Codebase Intelligence** - Existing patterns, dependencies
3. **Technical Specifications** - Code snippets, configurations
4. **Implementation Runbook** - Step-by-step execution
5. **Validation Loops** - Pre/during/post checks
6. **Risk Mitigation** - Potential risks and mitigations
7. **References** - Internal and external resources

## Constitution Compliance

All features must comply with `constitution.md`:

1. **5-file component pattern** - index.tsx, Component.tsx, .test.tsx, .stories.tsx, .accessibility.test.tsx
2. **TDD** - Tests before implementation, 25%+ coverage
3. **SpecKit workflow** - Complete sequence, no skipped steps
4. **Docker-first** - No local installs
5. **Progressive enhancement** - PWA, a11y, mobile-first
6. **Privacy first** - GDPR, consent before tracking

**Critical**: Static export to GitHub Pages - no server-side API routes. All server logic via Supabase Edge Functions.

## Tech Stack

- Next.js 15+ (App Router, static export)
- React 19+ with TypeScript strict
- Tailwind CSS 4 + DaisyUI
- Supabase (Auth, DB, Storage, Realtime, Edge Functions)
- Vitest (unit), Playwright (E2E), Pa11y (a11y)
