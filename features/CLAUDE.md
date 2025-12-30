# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This folder contains **45 feature specifications** (PRPs) for ScriptHammer, ready for the SpecKit workflow.

## Folder Structure

```
features/
├── foundation/       (001-006) Auth, a11y, security, template
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
/speckit.specify        # 1. Generate spec.md from *_feature.md
/speckit.clarify        # 2. Refine requirements interactively
/wireframe              # 3. Generate dark theme SVG wireframes (1400x800)
# --- STOP FOR REVIEW --- User reviews wireframes before continuing
/speckit.plan           # 4. Generate plan.md (implementation design)
/speckit.checklist      # 5. Generate checklist.md (implementation checklist)
/speckit.tasks          # 6. Generate tasks.md (actionable breakdown)
/speckit.analyze        # 7. Review cross-artifact consistency
/speckit.implement      # 8. Execute implementation
```

**All steps are mandatory.** Wait for user review after wireframe generation before proceeding to plan.

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
