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
/speckit.specify        # 1. Generate spec.md from *_feature.md
/speckit.clarify        # 2. Refine requirements interactively
/wireframe              # 3. Generate SVG wireframes (1400x800)

# Phase 2: Wireframe Review (MANDATORY GATE)
/wireframe-review       # 4. Review SVGs with 🟢/🔴 classification (4 phases + half-view)
/wireframe              # 5. Smart: patches 🟢, regenerates 🔴, skips ✅
# REPEAT until all wireframes pass review

# Phase 3: Implementation (BLOCKED until Phase 2 complete)
/speckit.plan           # 5. Generate plan.md (implementation design)
/speckit.checklist      # 6. Generate checklist.md (implementation checklist)
/speckit.tasks          # 7. Generate tasks.md (actionable breakdown)
/speckit.analyze        # 8. Review cross-artifact consistency
/speckit.implement      # 9. Execute implementation
```

**All steps are mandatory.** Phase 3 is BLOCKED until wireframe review is complete for ALL features.

## Wireframe Review Process

**Key Insight**: Patching structural issues makes things WORSE. Only patch cosmetic issues.

| Issue Type | Classification | Action |
|------------|----------------|--------|
| Wrong color value | 🟢 PATCHABLE | `/wireframe` patches in place |
| Typo in text | 🟢 PATCHABLE | `/wireframe` patches in place |
| Font size wrong | 🟢 PATCHABLE | `/wireframe` patches in place |
| Missing CSS class | 🟢 PATCHABLE | `/wireframe` patches in place |
| Layout problems | 🔴 REGENERATE | `/wireframe` regenerates with feedback |
| Spacing issues | 🔴 REGENERATE | `/wireframe` regenerates with feedback |
| Overlapping elements | 🔴 REGENERATE | `/wireframe` regenerates with feedback |
| Positioning errors | 🔴 REGENERATE | `/wireframe` regenerates with feedback |

### Wireframe Review File Structure

**CRITICAL**: Each SVG gets its own issues file. Review ONLY documents - it does NOT patch.

| File Type | Location | Purpose |
|-----------|----------|---------|
| Per-SVG issues | `docs/design/wireframes/[feature]/[svg-name].issues.md` | Detailed review findings for ONE SVG |
| Feature summary | `features/[category]/[feature]/WIREFRAME_ISSUES.md` | Historical context only (do NOT update during review) |

**Workflow**:
1. `/wireframe-review [feature:page]` → Creates `[svg-name].issues.md` in wireframes folder
2. `/wireframe [feature]` → Reads `.issues.md` files, applies patches or regenerates
3. Repeat until all issues resolved

**Rules**:
- One issues file per SVG (never combine multiple SVGs into one file)
- Review documents issues only (never patches the SVG directly)
- `/wireframe` reads issues files and applies fixes
- Feature-level `WIREFRAME_ISSUES.md` is historical context, not updated by review

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
