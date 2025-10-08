<!--
Sync Impact Report - Feature 022 Review
Review Date: 2025-10-08
Version: 1.0.1 (no changes)
Reviewed For: Feature 022 - User Avatar Upload

Constitutional Alignment:
  ✅ I. Component Structure Compliance - AvatarUpload/AvatarDisplay follow 5-file pattern
  ✅ II. Test-First Development - Tasks include TDD workflow (tests before implementation)
  ✅ III. PRP Methodology - Feature using /specify → /plan → /tasks → /implement workflow
  ✅ IV. Docker-First Development - All development in Docker containers
  ✅ V. Progressive Enhancement - Client-side crop, progressive upload, offline capable
  ✅ VI. Privacy & Compliance First - RLS policies, user consent, GDPR compliance

Template Consistency:
  ✅ .specify/templates/plan-template.md - Constitution Check section present (lines 30-34)
  ✅ .specify/templates/spec-template.md - User story/requirements structure aligns
  ✅ .specify/templates/tasks-template.md - PRP workflow and phase organization present
  ✅ .specify/templates/commands/*.md - No command templates found (expected)

Action Items:
  ⚠️  specs/022-on-the-account/plan.md:43 - Incorrectly states "(template only - no project-specific constitution)"
      Should read: "ScriptHammer Constitution v1.0.1 (6 core principles)"

Version Decision: No version bump required
  - No principles modified, added, or removed
  - No governance changes
  - Review confirms existing constitution fully covers Feature 022 requirements
  - Constitution v1.0.1 remains current (ratified 2025-09-20, last amended 2025-09-25)

Follow-up: None - constitution is complete and aligned
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

### III. PRP Methodology (Product Requirements Prompts)

Features are implemented using the PRP workflow: define requirements in a PRP
document, execute /plan command for technical planning, execute /tasks for
task generation, then implement. Each PRP tracks from inception to completion
with clear success criteria. PRPs supersede ad-hoc feature development.

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

**Version**: 1.0.1 | **Ratified**: 2025-09-20 | **Last Amended**: 2025-09-25
