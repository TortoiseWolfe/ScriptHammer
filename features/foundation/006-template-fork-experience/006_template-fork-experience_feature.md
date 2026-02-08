# Feature Specification: Template Fork Experience

**Feature Branch**: `011-feature-038-template`
**Created**: 2025-12-10
**Status**: Draft
**Input**: User description: "Feature 038: Template Fork Experience - Improve the forking experience based on real-world feedback from SpokeToWork fork."

## Clarifications

### Session 2025-12-10

- Q: How should the rebrand script handle special characters in project name? → A: Auto-sanitize (convert spaces to hyphens, remove special chars silently)
- Q: What should happen if rebrand script is run on a previously rebranded repo? → A: Detect re-rebrand scenario and prompt user for confirmation before proceeding
- Q: What UI should the app display when Supabase is not configured? → A: Dismissible banner alert at top with setup instructions link
- Q: What output should the rebrand script provide during execution? → A: Verbose (print each file as it's modified)
- Q: Should the rebrand script also update the git remote URL? → A: Yes, auto-update origin remote to new owner/name

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Automated Rebranding (Priority: P1)

A developer forks ScriptHammer to create their own project. They run a single rebrand script that automatically updates all 200+ hardcoded references (project name, owner, descriptions) and renames files, reducing setup from 2 hours to under 5 minutes.

**Why this priority**: This is the core pain point - manual updates across 200+ files is the primary barrier to adoption. Automating this delivers immediate, measurable value.

**Independent Test**: Can be fully tested by forking the repo, running `./scripts/rebrand.sh NewProject NewOwner "New description"`, and verifying the app builds and runs with the new name everywhere.

**Acceptance Scenarios**:

1. **Given** a fresh fork of ScriptHammer, **When** user runs `./scripts/rebrand.sh MyApp myuser "My app description"`, **Then** all occurrences of "ScriptHammer" and "scripthammer" are replaced with "MyApp" and "myapp" respectively
2. **Given** the rebrand script has run, **When** user runs `docker compose up && docker compose exec myapp pnpm run build`, **Then** the build succeeds with zero errors
3. **Given** files named with "ScriptHammer" (e.g., `ScriptHammerLogo.tsx`), **When** rebrand script runs, **Then** files are renamed to use the new project name (e.g., `MyAppLogo.tsx`)
4. **Given** the rebrand script runs, **When** user checks `public/CNAME`, **Then** the file has been deleted (unless custom domain specified)

---

### User Story 2 - Tests Pass Without Supabase Config (Priority: P2)

A developer forks the template and wants to run tests before setting up Supabase. Tests should pass with comprehensive mocks instead of throwing "Missing Supabase environment variables" errors.

**Why this priority**: Tests failing immediately after fork creates a poor first impression and blocks CI/CD setup. This is the second-biggest friction point.

**Independent Test**: Can be tested by removing Supabase env vars from .env and running `docker compose exec scripthammer pnpm test` - all tests should pass.

**Acceptance Scenarios**:

1. **Given** a fresh fork with no `.env` file, **When** user runs `pnpm test`, **Then** all unit tests pass using mocked Supabase client
2. **Given** the test setup file, **When** tests import Supabase client, **Then** they receive a comprehensive mock with auth, database, and realtime channel methods
3. **Given** project description tests, **When** they run after rebranding, **Then** they use generic assertions that don't depend on specific description text

---

### User Story 3 - GitHub Pages Deploys Correctly (Priority: P3)

A developer enables GitHub Pages on their fork. The site deploys correctly with proper asset paths, without needing to configure any secrets beyond Supabase credentials.

**Why this priority**: Broken deployments (white screen, missing CSS) are a critical UX failure that makes the template appear broken.

**Independent Test**: Can be tested by forking, enabling GitHub Pages with "GitHub Actions" source, and verifying the deployed site loads correctly.

**Acceptance Scenarios**:

1. **Given** a fork without `NEXT_PUBLIC_BASE_PATH` secret configured, **When** GitHub Actions runs deploy.yml, **Then** base path is auto-detected from repo name
2. **Given** `deploy.yml` workflow, **When** it checks for `NEXT_PUBLIC_BASE_PATH`, **Then** empty string is treated as undefined, allowing auto-detection
3. **Given** the auto-detection script, **When** it runs in GitHub Actions, **Then** it correctly sets basePath to `/<repo-name>` for forks

---

### User Story 4 - Docker Git Workflow Works (Priority: P4)

A developer working in the Docker-first environment can commit changes without "lint-staged not found" errors or "dubious ownership" warnings.

**Why this priority**: Git workflow friction affects daily development but has documented workarounds.

**Independent Test**: Can be tested by running `docker compose exec scripthammer git commit -m "test"` after making a change.

**Acceptance Scenarios**:

1. **Given** the Dockerfile, **When** container builds, **Then** git safe.directory is configured for /app
2. **Given** documentation, **When** developer reads commit instructions, **Then** they understand to use `docker compose exec` for git commands
3. **Given** `.env.example`, **When** developer copies it, **Then** GIT_AUTHOR_NAME and GIT_AUTHOR_EMAIL fields are present with instructions

---

### User Story 5 - Production App Loads Without Supabase (Priority: P5)

A developer deploys to GitHub Pages before configuring Supabase. The app should show a helpful "Setup Required" message instead of crashing with "Something went wrong!"

**Why this priority**: While Supabase is required for full functionality, a graceful degradation improves the setup experience.

**Independent Test**: Can be tested by deploying without Supabase secrets and verifying the app loads with setup instructions.

**Acceptance Scenarios**:

1. **Given** missing Supabase env vars in production, **When** app loads, **Then** it displays a dismissible banner alert at top with link to setup instructions
2. **Given** the Supabase client initialization, **When** env vars are missing, **Then** it returns a disabled mock client or deferred initialization
3. **Given** the setup banner is displayed, **When** user dismisses it, **Then** banner does not reappear until next session

---

### Edge Cases

- ~~What happens when user runs rebrand script twice with different names?~~ → **Resolved**: Detect and prompt for confirmation
- ~~How does rebrand handle special characters in project name?~~ → **Resolved**: Auto-sanitize (spaces→hyphens, remove special chars)
- What if user has uncommitted changes when running rebrand? → Script should warn but proceed (git status check)
- How does the script handle case-sensitivity (MyApp vs myapp vs MYAPP)? → Preserve user's casing for display name, derive lowercase for technical names
- What if the fork was renamed in GitHub but not locally? → **Resolved**: Script updates git remote automatically

## Requirements _(mandatory)_

### Functional Requirements

**Rebrand Script (scripts/rebrand.sh)**

- **FR-001**: Script MUST accept project name, owner, and description as arguments
- **FR-002**: Script MUST replace all case variations of "ScriptHammer" with the new name
- **FR-003**: Script MUST rename files containing "ScriptHammer" in their names
- **FR-004**: Script MUST update docker-compose.yml service name
- **FR-005**: Script MUST delete public/CNAME unless `--keep-cname` flag is provided or CNAME contains a non-scripthammer.com domain
- **FR-006**: Script MUST update package.json name, description, and repository fields
- **FR-007**: Script MUST be idempotent (safe to run multiple times)
- **FR-007a**: Script MUST auto-sanitize project names (convert spaces to hyphens, remove special characters silently)
- **FR-007b**: Script MUST detect if repo was previously rebranded (no "ScriptHammer" references found) and prompt user for confirmation before proceeding
- **FR-007c**: Script MUST provide verbose output, printing each file path as it is modified or renamed
- **FR-007d**: Script MUST update git remote `origin` URL to `github.com/<new-owner>/<new-name>`

**Test Infrastructure**

- **FR-008**: tests/setup.ts MUST provide comprehensive Supabase client mock
- **FR-009**: Mock MUST include auth methods (getSession, getUser, signIn, signUp, signOut, onAuthStateChange)
- **FR-010**: Mock MUST include database methods (from, select, insert, update, delete)
- **FR-011**: Mock MUST include realtime methods (channel, on, subscribe, unsubscribe)
- **FR-012**: Project config tests MUST use generic assertions (e.g., `toBeTruthy()` not `toContain('specific text')`)

**GitHub Actions**

- **FR-013**: deploy.yml MUST NOT include NEXT_PUBLIC_BASE_PATH secret reference
- **FR-014**: next.config.ts MUST treat empty string basePath as undefined
- **FR-015**: Auto-detection script MUST correctly derive basePath from GITHUB_REPOSITORY

**Docker Configuration**

- **FR-016**: Dockerfile MUST configure git safe.directory for /app
- **FR-017**: docker-compose.yml MUST pass through GIT_AUTHOR_NAME and GIT_AUTHOR_EMAIL
- **FR-018**: .env.example MUST document git config variables

**Dynamic Configuration**

- **FR-019**: public/sw.js MUST use dynamic cache name from project config
- **FR-020**: Admin email MUST be configurable via ADMIN_EMAIL env var with fallback to `admin@scripthammer.com`
- **FR-021**: public/manifest.json MUST be in .gitignore (it's generated)

**Documentation**

- **FR-022**: README MUST include "Forking This Template" section with step-by-step guide
- **FR-023**: CLAUDE.md MUST document Supabase GitHub secrets requirement
- **FR-024**: Footer component MUST include attribution link to ScriptHammer.com

### Key Entities

- **Project Config**: Central configuration derived from package.json and git remote (name, owner, description, basePath)
- **Rebrand Script**: Shell script that transforms template to new project identity
- **Supabase Mock**: Vitest mock providing full Supabase client interface for testing

### 5-File Component Pattern Example

All new components created by this template MUST follow the 5-file pattern:

```
src/components/Example/
├── index.tsx                    # Re-exports
├── Example.tsx                  # Component implementation
├── Example.test.tsx             # Unit tests (Vitest)
├── Example.stories.tsx          # Storybook stories
└── Example.accessibility.test.tsx  # Accessibility tests (Pa11y)
```

**Storybook Story Example**:

```typescript
// Example.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Example } from './Example';

const meta: Meta<typeof Example> = {
  title: 'Components/Example',
  component: Example,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'An example component demonstrating the 5-file pattern.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: 'Example' } };
export const Primary: Story = {
  args: { children: 'Primary', variant: 'primary' },
};
export const Disabled: Story = {
  args: { children: 'Disabled', disabled: true },
};
```

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Fork setup time reduced from 2 hours to under 5 minutes (verified by timing a fresh fork workflow)
- **SC-002**: `pnpm test` passes on fresh fork with no .env file (0 Supabase-related failures)
- **SC-003**: GitHub Pages deployment works without configuring NEXT_PUBLIC_BASE_PATH secret (site loads with correct asset paths)
- **SC-004**: `docker compose exec <project> git commit` works without "lint-staged not found" error
- **SC-005**: Rebrand script successfully updates 200+ files with zero manual edits required
- **SC-006**: Build succeeds after rebrand with zero TypeScript errors from import mismatches
