<!--
Sync Impact Report - v1.0.2 Amendment (Wireframe Gate Hardening)
Review Date: 2026-05-06
Version: 1.0.1 → 1.0.2 (MINOR amendment — Principle III hardening)
Reviewed For: Issue #73 — promote wireframe step to a hard gate

Amendment Summary:
  Principle III ("PRP Methodology") was previously silent on the wireframe
  step, treating wireframe authoring as an optional hook absorbed into the
  Developer/UIDesigner roles. The 2026-05-02 strategy session (operator
  decision; see ~/.claude/plans/trying-to-decide-on-gleaming-kitten.md)
  promoted wireframes to a hard gate between /speckit.clarify and
  /speckit.plan for all web/RN/KDG/Drupal tracks. Unity remains exempt
  (game scenes are mocked in-Editor, not via SVG).

  This amendment bakes that decision into the constitution as the
  source-of-truth so the rest of the GrimGlow IP family (RN ScriptHammer,
  KDG-stack, Headless Drupal templates) inherits the hardened gate when
  each track's v1.0.0 ratifies.

Constitutional Alignment (re-checked at v1.0.2):
  ✅ I. Component Structure Compliance — unchanged
  ✅ II. Test-First Development — unchanged
  ⬆ III. PRP Methodology — HARDENED. Cascade now mandates the wireframe
      gate; pure-infra PRPs ship a "no UI" stub rather than skipping.
  ✅ IV. Docker-First Development — unchanged
  ✅ V. Progressive Enhancement — unchanged
  ✅ VI. Privacy & Compliance First — unchanged

Template Consistency:
  ☐ .specify/templates/plan-template.md — review for cascade reference
  ☐ .specify/templates/spec-template.md — review for cascade reference
  ☐ .specify/templates/tasks-template.md — review for cascade reference
  ☐ .specify/templates/commands/*.md — verify no command file references
      the old "wireframes optional" framing

Family Propagation (informational):
  - GrimGlow Phase 1 constitution v1.0.1 — already shipped
    (TortoiseWolfe/GrimGlow_planning commit 2466343)
  - Unity GrimGlow constitution — EXEMPT (Unity track stays at v1.0.1
    on this dimension; in-Editor mocking is the wireframe equivalent)
  - RN ScriptHammer / KDG-stack / Headless Drupal — inherit the v1.0.2
    cascade when each track's v1.0.0 ratifies

Version Decision: MINOR bump to v1.0.2
  - Principle III text changed; cascade newly enumerated
  - No principles added or removed
  - No governance changes
  - Workspace ~/repos/CLAUDE.md cite updated v1.0.1 → v1.0.2
  - Strategy plan ~/.claude/plans/trying-to-decide-on-gleaming-kitten.md
    cite updated v1.0.1 → v1.0.2
-->

# ScriptHammer Constitution

## Core Principles

### I. Component Structure Compliance

Every component MUST follow the 5-file pattern: index.tsx, Component.tsx,
Component.test.tsx, Component.stories.tsx, and Component.accessibility.test.tsx.
This structure is enforced via CI/CD pipeline validation. Use the component
generator (`pnpm run generate:component`) to ensure compliance. No exceptions
are permitted - manual component creation will cause build failures.

### II. Test-First Development

Tests MUST be written before implementation following RED-GREEN-REFACTOR cycle.
Minimum test coverage of 25% for unit tests, with critical paths requiring
comprehensive test suites. E2E tests via Playwright for user workflows.
Accessibility tests using Pa11y for WCAG compliance. Tests run on pre-push
via Husky hooks.

### III. PRP Methodology with Mandatory Wireframe Gate

Features are implemented using the PRP workflow as a hard, ordered cascade.
The wireframe authoring + review step is a **mandatory gate** between
clarification and planning — it is NOT an optional hook absorbed into a
role. Pure-infrastructure PRPs (no UI surface, no API visualization) ship a
"no UI" wireframe stub for explicitness rather than skipping the step.

The cascade is:

```
PRP → /speckit.specify → /speckit.clarify
    → /speckit.wireframe.generate → /speckit.wireframe.review     [HARD GATE]
    → /speckit.plan → /speckit.checklist → /speckit.tasks
    → /speckit.analyze → /speckit.implement
    → /speckit.wireframe.screenshots                              [post-implement regression]
```

**Why a hard gate:** the 2026-05-02 strategy session confirmed (via
operator practice on the Unity track without mockups) that the discipline
matters even where the step has been treated as optional. Promoting the
gate to mandatory eliminates the "I'll skip wireframes for this one"
exception that erodes the discipline over time. Each PRP tracks from
inception to completion with clear success criteria. PRPs supersede ad-hoc
feature development.

**Track exemption:** Unity tracks are exempt from this gate. Unity's
in-Editor scene mocking serves the same purpose as SVG wireframes for web
work; the SVG validator does not apply to Unity prefabs/scenes. All
non-Unity tracks (web/RN/KDG/Drupal) inherit this hardened gate when their
constitution ratifies at v1.0.0.

### IV. Docker-First Development

Docker Compose is the primary development environment to ensure consistency
across all developers. Local development is supported but Docker takes
precedence for debugging environment issues. All CI/CD uses containerized
environments. Production deployment assumes containerization.

### V. Progressive Enhancement

Start with core functionality that works everywhere, then enhance with
progressive features. PWA capabilities for offline support. Accessibility
features (colorblind modes, font switching) as first-class requirements.
Performance optimization targeting 90+ Lighthouse scores. Mobile-first
responsive design.

### VI. Privacy & Compliance First

GDPR compliance is mandatory with explicit consent for all data collection.
Cookie consent system must be implemented before any tracking. Analytics
only activate after user consent. Geolocation requires explicit permission.
Third-party services need consent modals. Privacy controls accessible to users.

## Technical Standards

### Framework Requirements

- Next.js 15.5+ with App Router and static export
- React 19+ with TypeScript strict mode
- Tailwind CSS 4 with DaisyUI for theming
- pnpm 10.16.1 as package manager
- Node.js 20+ LTS version

### Testing Standards

- Vitest for unit testing (58%+ coverage target)
- Playwright for E2E testing (40+ test scenarios)
- Pa11y for accessibility testing (WCAG AA)
- Storybook for component documentation
- MSW for API mocking in tests

### Code Quality

- ESLint with Next.js configuration
- Prettier for consistent formatting
- TypeScript strict mode enabled
- Husky pre-commit hooks for validation
- Component structure validation in CI/CD

## Development Workflow

### Sprint Methodology

Sprints follow PRP completion cycles with clear milestones. Technical debt
reduction sprints occur between feature sprints. Each sprint has defined
success metrics and test coverage goals. Sprint constitutions may supersede
this document temporarily for focused work.

### PRP Execution Flow

1. Create PRP document with requirements
2. Run /plan command for technical approach
3. Run /tasks command for task breakdown
4. Implement following generated tasks
5. Validate against PRP success criteria
6. Update PRP status dashboard

### Contribution Process

- Fork repository and use auto-configuration
- Create feature branch following naming convention
- Implement using Docker environment
- Ensure all tests pass before push
- Submit PR with comprehensive description
- Pass all CI/CD checks for merge

## Quality Gates

### Build Requirements

- All components follow 5-file structure
- TypeScript compilation without errors
- Build completes without warnings
- Static export generates successfully
- Bundle size under 150KB first load

### Test Requirements

- Unit test coverage above 25% minimum
- All accessibility tests passing
- E2E tests run successfully locally
- No failing tests in test suite
- Storybook stories render without errors

### Performance Standards

- Lighthouse Performance: 90+ score
- Lighthouse Accessibility: 95+ score
- First Contentful Paint under 2 seconds
- Time to Interactive under 3.5 seconds
- Cumulative Layout Shift under 0.1

### Accessibility Standards

- WCAG 2.1 Level AA compliance
- Keyboard navigation fully functional
- Screen reader compatibility verified
- Color contrast ratios meet standards
- Focus indicators clearly visible

## Governance

### Amendment Procedure

Constitution amendments require documentation of rationale, impact analysis
on existing codebase, migration plan if breaking changes, and approval via
repository discussion. Major version bumps for principle changes, minor for
additions, patch for clarifications.

### Compliance Verification

All pull requests must verify constitutional compliance. CI/CD pipeline
enforces technical standards automatically. Code reviews check principle
adherence. Sprint retrospectives evaluate constitution effectiveness.

### Version Management

Constitution follows semantic versioning. Sprint-specific constitutions may
temporarily override for focused work. All versions archived in spec-kit
directory. Amendments tracked with ratification dates.

### Enforcement

The constitution supersedes all other practices. Violations must be justified
with documented rationale. Temporary exceptions require sprint constitution.
Use CLAUDE.md for runtime development guidance specific to AI assistance.

**Version**: 1.0.2 | **Ratified**: 2025-09-20 (v1.0.1) | **Last Amended**: 2026-05-06 (v1.0.2)

## Amendment Log

### v1.0.2 — 2026-05-06 — Wireframe Gate Hardening

**Scope:** Principle III (PRP Methodology).

**Change:** Promoted the wireframe authoring + review step from an
implicit role-absorbed hook to an explicit mandatory gate between
`/speckit.clarify` and `/speckit.plan`. Enumerated the full cascade in
Principle III. Added explicit handling for pure-infrastructure PRPs ("no
UI" stub instead of skipping) and an explicit Unity track exemption.

**Rationale:** Per the 2026-05-02 strategy session
(`~/.claude/plans/trying-to-decide-on-gleaming-kitten.md`), operator
practice on the Unity track without mockups confirmed the discipline
matters even where it had been treated as optional. The
`.specify/extensions/wireframe/` toolchain (6 skills, validator, viewer)
already exists and is in use; the constitution was lagging the practice.
This amendment closes that gap and propagates the hardened gate to the
rest of the GrimGlow IP family (RN ScriptHammer, KDG-stack, Headless
Drupal) when each track's v1.0.0 ratifies.

**Impact:** No code changes required. Existing PRPs already follow this
cascade in practice (see `features/CLAUDE.md` workflow documentation).
This amendment is the source-of-truth alignment.

**Family propagation:**

- GrimGlow Phase 1 constitution v1.0.1 — already shipped
  (TortoiseWolfe/GrimGlow_planning commit 2466343)
- Unity GrimGlow constitution — exempt; stays at v1.0.1 on this dimension
- RN ScriptHammer / KDG-stack / Headless Drupal — inherit when each
  track's v1.0.0 ratifies

### v1.0.1 — 2025-09-25

(Pre-amendment-log baseline; no scope recorded in this format.)

### v1.0.0 — 2025-09-20

Constitution ratified.
