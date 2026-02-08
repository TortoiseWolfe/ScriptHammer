# Feature Specification: Template Fork Experience

**Feature Branch**: `006-template-fork-experience`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Improve the forking experience based on real-world feedback from SpokeToWork fork."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Automated Rebranding (Priority: P0)

As a developer, I need to transform a forked template into my own branded project with a single command so that I can start building immediately instead of spending hours on manual find-and-replace operations.

**Why this priority**: This is the core pain point - manual updates across 200+ files is the primary barrier to template adoption. Automating this delivers immediate, measurable value and is the fundamental value proposition.

**Independent Test**: Can be fully tested by forking the repository, running the rebrand automation with custom project details, and verifying the application builds and runs with the new identity throughout.

**Acceptance Scenarios**:

1. **Given** a fresh fork of the template, **When** user runs the rebrand automation with project name, owner, and description, **Then** all references to the original project are replaced with the new identity
2. **Given** the rebrand automation has run, **When** user builds the project, **Then** the build succeeds with zero errors
3. **Given** files named with the original project name, **When** rebrand runs, **Then** files are renamed to use the new project name
4. **Given** the rebrand automation runs, **When** user checks deployment configuration files, **Then** original deployment settings have been cleared or updated

---

### User Story 2 - Tests Pass Without External Services (Priority: P0)

As a developer, I need to run the test suite immediately after forking before configuring any external services so that I can verify the codebase works and begin development with confidence.

**Why this priority**: Tests failing immediately after fork creates a poor first impression and blocks continuous integration setup. This is the second-biggest friction point after manual rebranding.

**Independent Test**: Can be tested by removing all external service credentials and running the test suite - all tests should pass using comprehensive mocks.

**Acceptance Scenarios**:

1. **Given** a fresh fork with no external service configuration, **When** user runs the test suite, **Then** all unit tests pass using mocked service clients
2. **Given** tests that interact with authentication, database, or realtime features, **When** they execute, **Then** they receive comprehensive mock implementations
3. **Given** tests that validate project metadata, **When** they run after rebranding, **Then** they use generic assertions that don't depend on specific text content

---

### User Story 3 - Deployment Works Automatically (Priority: P1)

As a developer, I need my fork to deploy correctly to static hosting without manual path configuration so that the site works immediately when I enable deployment.

**Why this priority**: Broken deployments (white screen, missing assets) make the template appear broken and erode trust in the template quality.

**Independent Test**: Can be tested by enabling static hosting deployment and verifying the deployed site loads correctly with all assets.

**Acceptance Scenarios**:

1. **Given** a fork without custom base path configuration, **When** deployment runs, **Then** the base path is auto-detected from the repository name
2. **Given** deployment workflow runs, **When** checking for base path configuration, **Then** empty values are treated as "auto-detect" rather than "empty string"
3. **Given** the auto-detection process, **When** it runs in the deployment environment, **Then** it correctly derives the deployment path for forked repositories

---

### User Story 4 - Development Environment Git Workflow (Priority: P1)

As a developer working in a containerized development environment, I need to commit changes without errors or warnings so that my normal git workflow is uninterrupted.

**Why this priority**: Git workflow friction affects daily development productivity but has documented workarounds.

**Independent Test**: Can be tested by making a change in the development container and committing it successfully.

**Acceptance Scenarios**:

1. **Given** the development container, **When** it starts, **Then** git directory permissions are configured correctly
2. **Given** documentation, **When** developer reads commit instructions, **Then** they understand the recommended workflow
3. **Given** environment configuration examples, **When** developer sets them up, **Then** git author information is correctly configured

---

### User Story 5 - Graceful Degradation Without Services (Priority: P2)

As a developer, I need the application to display helpful guidance instead of crashing when external services aren't configured so that I can understand what setup is required.

**Why this priority**: While external services are required for full functionality, graceful degradation with clear setup guidance improves the onboarding experience.

**Independent Test**: Can be tested by running the application without external service configuration and verifying it loads with setup instructions.

**Acceptance Scenarios**:

1. **Given** missing external service configuration in production, **When** application loads, **Then** it displays a dismissible guidance banner with setup instructions
2. **Given** the service client initialization, **When** configuration is missing, **Then** it returns a safe placeholder or deferred initialization
3. **Given** the guidance banner is displayed, **When** user dismisses it, **Then** banner does not reappear until the next session

---

### Edge Cases

- What happens when user runs rebrand automation twice with different names?
  - System detects previously rebranded state and prompts for confirmation before proceeding

- How does rebrand handle special characters in project name?
  - System auto-sanitizes input (spaces to hyphens, removes special characters)

- What if user has uncommitted changes when running rebrand?
  - System warns about uncommitted changes but proceeds (non-blocking)

- How does the automation handle case-sensitivity (MyApp vs myapp vs MYAPP)?
  - Preserves user's casing for display name, derives lowercase for technical identifiers

- What if the fork was renamed remotely but not locally?
  - System updates local remote configuration automatically

---

## Requirements _(mandatory)_

### Functional Requirements

**Rebrand Automation**

- **FR-001**: System MUST accept project name, owner, and description as inputs
- **FR-002**: System MUST replace all case variations of the original project name with the new name
- **FR-003**: System MUST rename files containing the original project name in their filenames
- **FR-004**: System MUST update container/service configuration with the new project name
- **FR-005**: System MUST clear deployment-specific configurations unless user opts to keep them
- **FR-006**: System MUST update package metadata (name, description, repository fields)
- **FR-007**: System MUST be idempotent (safe to run multiple times)
- **FR-008**: System MUST auto-sanitize project names (spaces to hyphens, remove special characters)
- **FR-009**: System MUST detect if repository was previously rebranded and prompt for confirmation
- **FR-010**: System MUST provide verbose output showing each file modified
- **FR-011**: System MUST update version control remote URL to new owner/repository name

**Test Infrastructure**

- **FR-012**: Test setup MUST provide comprehensive external service mock
- **FR-013**: Mock MUST include authentication methods (session, user, sign-in, sign-up, sign-out, state changes)
- **FR-014**: Mock MUST include data access methods (query, select, insert, update, delete)
- **FR-015**: Mock MUST include realtime methods (channels, subscriptions)
- **FR-016**: Project metadata tests MUST use generic assertions independent of specific content

**Deployment Automation**

- **FR-017**: Deployment workflow MUST NOT require manual base path secret configuration
- **FR-018**: Build configuration MUST treat empty base path as "auto-detect"
- **FR-019**: Auto-detection MUST correctly derive deployment path from repository information

**Development Environment**

- **FR-020**: Container configuration MUST set up git directory permissions correctly
- **FR-021**: Container configuration MUST pass through author name and email settings
- **FR-022**: Environment examples MUST document git configuration variables

**Dynamic Configuration**

- **FR-023**: Service worker MUST use dynamic cache name from project configuration
- **FR-024**: Administrative contact MUST be configurable with sensible fallback
- **FR-025**: Generated configuration files MUST be excluded from version control

**Documentation & Attribution**

- **FR-026**: Documentation MUST include "Forking This Template" section with step-by-step guide
- **FR-027**: Developer documentation MUST explain external service configuration requirements
- **FR-028**: Application footer MUST include attribution link to original template

### Key Entities

- **Project Configuration**: Central identity derived from package metadata and version control (name, owner, description, deployment path)
- **Rebrand Automation**: Tool that transforms template to new project identity across all files
- **Service Mock**: Test infrastructure providing full external service interface for offline testing
- **Guidance Banner**: Dismissible UI element explaining required setup steps

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Fork setup time reduced from 2 hours to under 5 minutes (verified by timing a fresh fork workflow)
- **SC-002**: Test suite passes on fresh fork with no external service configuration (0 service-related failures)
- **SC-003**: Static hosting deployment works without manual path configuration (site loads with correct asset paths)
- **SC-004**: Git commits in development container succeed without permission errors
- **SC-005**: Rebrand automation successfully updates 200+ files with zero manual edits required
- **SC-006**: Build succeeds after rebrand with zero import or reference errors

---

## Constraints _(optional - include if relevant)_

- Must work with static-only hosting (no server-side rendering)
- Must be automatable via command line (no GUI required)
- Must work in containerized development environments
- Attribution to original template must be preserved

---

## Dependencies _(optional - include if relevant)_

- Version control system for fork detection and remote updates
- Container runtime for development environment
- Static hosting platform with deployment automation
- Test framework with mocking capabilities

---

## Assumptions _(optional - include if relevant)_

- Developers are comfortable with command-line tools
- Developers have container runtime installed locally
- Network access available for external service setup (when ready)
- Deployment platform supports automated builds from version control

---

## Clarifications

### Session 2025-12-10

- Q: How should the rebrand automation handle special characters in project name? → A: Auto-sanitize (convert spaces to hyphens, remove special chars silently)
- Q: What should happen if rebrand is run on a previously rebranded repo? → A: Detect re-rebrand scenario and prompt user for confirmation before proceeding
- Q: What UI should the app display when external services are not configured? → A: Dismissible banner alert at top with setup instructions link
- Q: What output should the rebrand automation provide during execution? → A: Verbose (print each file as it's modified)
- Q: Should the rebrand automation also update the git remote URL? → A: Yes, auto-update origin remote to new owner/name
