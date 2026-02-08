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

Features are implemented using the SpecKit workflow: define requirements with
/speckit.specify, refine with /speckit.clarify, plan with /speckit.plan,
generate tasks with /speckit.tasks, then implement with /speckit.implement.
Each PRP tracks from inception to completion with clear success criteria.
PRPs supersede ad-hoc feature development.

### IV. Docker-First Development

Docker Compose is the primary development environment to ensure consistency
across all developers. Local pnpm/npm installs are FORBIDDEN. All commands
run inside Docker containers. All CI/CD uses containerized environments.
Git commits must run from inside containers to ensure hooks execute correctly.

### V. Progressive Enhancement

Start with core functionality that works everywhere, then enhance with
progressive features. PWA capabilities for offline support. Accessibility
features (colorblind modes, font switching) as first-class requirements.
Performance optimization targeting 90+ Lighthouse scores. Mobile-first
responsive design with 44px minimum touch targets.

### VI. Privacy & Compliance First

GDPR compliance is mandatory with explicit consent for all data collection.
Cookie consent system must be implemented before any tracking. Analytics
only activate after user consent. Geolocation requires explicit permission.
Third-party services need consent modals. Privacy controls accessible to users.

## Technical Standards

### Framework Requirements

- Next.js 15+ with App Router and static export
- React 19+ with TypeScript strict mode
- Tailwind CSS 4 with DaisyUI for theming
- Supabase for Auth, Database, Storage, Realtime, Edge Functions
- pnpm as package manager (inside Docker only)
- Node.js 20+ LTS version

### Static Export Constraint

This application deploys to static hosting (GitHub Pages). This means:

- NO server-side API routes (`src/app/api/` won't work in production)
- All server-side logic MUST be in Supabase (Edge Functions, triggers, RLS)
- Secrets must be stored in Supabase Vault, never in client code
- Client-only has access to `NEXT_PUBLIC_*` environment variables

### Supabase Patterns

- **Monolithic Migrations**: Single migration file with idempotent statements (IF NOT EXISTS)
- **Row-Level Security**: RLS policies required for all tables
- **Edge Functions**: Server-side logic requiring secrets
- **Management API**: Execute migrations via API, never local CLI on free tier
- **Keep-Alive**: Run `pnpm run prime` weekly to prevent auto-pause

### Testing Standards

- Vitest for unit testing (25%+ coverage minimum)
- Playwright for E2E testing (Chromium, Firefox, WebKit)
- Pa11y for accessibility testing (WCAG AA compliance)
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

### SpecKit Execution Flow

1. Create feature description
2. Run /speckit.specify for specification
3. Run /speckit.clarify for requirement refinement
4. Run /speckit.plan for technical approach
5. Run /speckit.checklist for implementation checklist
6. Run /speckit.tasks for task breakdown
7. Run /speckit.analyze for consistency check
8. Run /speckit.implement for execution

### Wireframe Workflow

Before implementation, generate wireframes to visualize the feature:

1. Run /wireframe (dark theme) or /wireframe-light (light theme)
2. Review side-by-side desktop + mobile wireframes (1920x1080)
3. Use /hot-reload-viewer to preview interactively
4. Iterate on design before coding

### Contribution Process

- Fork repository and use auto-configuration
- Create feature branch following naming convention
- Implement using Docker environment exclusively
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
temporarily override for focused work. All versions archived in .specify
directory. Amendments tracked with ratification dates.

### Enforcement

The constitution supersedes all other practices. Violations must be justified
with documented rationale. Temporary exceptions require sprint constitution.
Use CLAUDE.md for runtime development guidance specific to AI assistance.

**Version**: 1.0.0 | **Ratified**: 2025-12-29 | **Last Amended**: 2025-12-29
