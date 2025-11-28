# PRP Processing Workflow

**Version**: 1.0.0
**Created**: 2025-09-13
**Purpose**: Sequential implementation guide for processing 13 Product Requirements Prompts (PRPs)

---

## Overview

This document defines the workflow for processing 13 PRPs through the Specify system without creating 13 simultaneous branches. Each PRP will be processed sequentially, building upon previous work and maintaining a clean, manageable repository structure.

## Implementation Sequence

### Phase 1: Foundation (Must Complete First)

#### 1. Component Structure Standardization (`001-component-structure`)

- **Priority**: P0 (Constitutional Requirement)
- **Why First**: Ensures consistent 4-file pattern before building new components
- **Dependencies**: None
- **Deliverables**: Audit tool, scaffolding scripts, migrated components

#### 2. E2E Testing Framework (`002-e2e-testing`)

- **Priority**: P0 (Constitutional Requirement)
- **Why Second**: Testing infrastructure needed before feature development
- **Dependencies**: Component structure
- **Deliverables**: Playwright setup, test suites, CI integration

### Phase 2: Compliance & Accessibility

#### 3. WCAG AA Compliance (`003-wcag-compliance`)

- **Priority**: P0 (Constitutional Requirement)
- **Dependencies**: E2E testing framework
- **Deliverables**: Pa11y CI, axe-core integration, automated testing

#### 4. Colorblind Mode (`004-colorblind-mode`)

- **Priority**: P0 (Constitutional Requirement)
- **Dependencies**: WCAG compliance (extends accessibility)
- **Deliverables**: Filter system, theme integration, UI controls

#### 5. Font Switcher (`005-font-switcher`)

- **Priority**: P1 (Constitutional Enhancement)
- **Dependencies**: Colorblind mode (extends accessibility controls)
- **Deliverables**: Typography system, font selector, persistence

### Phase 3: Privacy & Analytics

#### 6. Cookie Consent & GDPR (`006-cookie-consent`)

- **Priority**: P0 (Constitutional Requirement)
- **Dependencies**: Component structure
- **Deliverables**: Consent modal, privacy controls, data management

#### 7. Google Analytics (`007-google-analytics`)

- **Priority**: P1 (Constitutional Enhancement)
- **Dependencies**: Cookie consent (requires consent management)
- **Deliverables**: GA4 integration, event tracking, Web Vitals

### Phase 4: Forms & Communication

#### 8. Web3Forms Integration (`008-web3forms`)

- **Priority**: P0 (Constitutional Requirement)
- **Dependencies**: Component structure
- **Deliverables**: Contact form, validation, error handling

#### 9. EmailJS Integration (`009-emailjs-backup`)

- **Priority**: P1 (Constitutional Requirement)
- **Dependencies**: Web3Forms (provides fallback)
- **Deliverables**: Backup service, failover logic, monitoring

#### 10. PWA Background Sync (`010-pwa-sync`)

- **Priority**: P0 (Constitutional Requirement)
- **Dependencies**: Web3Forms, EmailJS
- **Deliverables**: Offline queue, sync worker, retry logic

### Phase 5: Additional Features

#### 11. Visual Regression Testing (`011-visual-regression`)

- **Priority**: P0 (Constitutional Requirement)
- **Dependencies**: E2E testing, Storybook
- **Deliverables**: Chromatic/Percy setup, snapshot tests

#### 12. Calendar Integration (`012-calendar`)

- **Priority**: P2 (Constitutional Enhancement)
- **Dependencies**: Component structure
- **Deliverables**: Calendly/Cal.com embed, booking flow

#### 13. Geolocation Map (`013-geolocation`)

- **Priority**: P2 (Constitutional Enhancement)
- **Dependencies**: Component structure, privacy controls
- **Deliverables**: Leaflet integration, location services

## Branch Workflow

### 1. Branch Creation

```bash
# Create feature branch for next PRP
git checkout -b 001-prp-methodology

# After completion and merge
git checkout main
git pull origin main
git checkout -b 002-component-structure
```

### 2. PRP to Feature Conversion

```bash
# Copy PRP content to feature spec
mkdir -p docs/specs/001-prp-methodology
cp docs/prp-docs/prp-methodology-prp.md docs/specs/001-prp-methodology/spec.md

# Run plan command
./plan

# Generate tasks
./tasks

# Begin implementation
```

### 3. Completion Criteria

- [ ] All tasks from `/tasks` completed
- [ ] Tests passing (unit, integration, E2E)
- [ ] Documentation updated
- [ ] PRP status updated to "✅ Completed"
- [ ] Branch merged to main
- [ ] Next PRP can begin

## Status Tracking

### Current Status

| Phase | PRP                 | Branch                    | Status   | Merged |
| ----- | ------------------- | ------------------------- | -------- | ------ |
| 1     | Component Structure | `001-component-structure` | 📥 Inbox | ❌     |
| 1     | E2E Testing         | `002-e2e-testing`         | 📥 Inbox | ❌     |
| 2     | WCAG Compliance     | `003-wcag-compliance`     | 📥 Inbox | ❌     |
| 2     | Colorblind Mode     | `004-colorblind-mode`     | 📥 Inbox | ❌     |
| 2     | Font Switcher       | `005-font-switcher`       | 📥 Inbox | ❌     |
| 3     | Cookie Consent      | `006-cookie-consent`      | 📥 Inbox | ❌     |
| 3     | Google Analytics    | `007-google-analytics`    | 📥 Inbox | ❌     |
| 4     | Web3Forms           | `008-web3forms`           | 📥 Inbox | ❌     |
| 4     | EmailJS             | `009-emailjs-backup`      | 📥 Inbox | ❌     |
| 4     | PWA Sync            | `010-pwa-sync`            | 📥 Inbox | ❌     |
| 5     | Visual Regression   | `011-visual-regression`   | 📥 Inbox | ❌     |
| 5     | Calendar            | `012-calendar`            | 📥 Inbox | ❌     |
| 5     | Geolocation         | `013-geolocation`         | 📥 Inbox | ❌     |

### Status Legend

- 📥 **Inbox**: Not started
- 🔄 **In Progress**: Active development
- ✅ **Completed**: Merged to main
- ⏸️ **Blocked**: Waiting on dependencies

## SpecKit Integration

**Version**: 2.0.0 (Updated 2025-09-30 with full SpecKit workflow)

ScriptHammer now uses the complete SpecKit workflow to convert PRPs into implemented features. This section documents the integration between PRP methodology and SpecKit commands.

### Before SpecKit (Original Workflow)

**Original Sequential Process**:

```
PRP Document → Feature Branch → Manual Planning → Implementation → Completion
```

This approach worked but required manual:

- Specification writing
- Implementation planning
- Task breakdown
- Dependency management

### With SpecKit Integration (Current Workflow)

**New Automated Process**:

```
PRP Document → prp-to-feature.sh → /specify → /clarify → /plan → /tasks → /implement → /analyze
```

SpecKit automates specification, planning, and task generation while maintaining the PRP product-thinking approach.

---

### Command-by-Command Integration

#### 1. PRP Creation (Manual)

**What**: Write Product Requirements Prompt
**When**: Before any development
**Output**: `docs/prp-docs/<feature>-prp.md`

PRPs remain the **product thinking** layer - defining WHAT and WHY from a business perspective.

**PRP Structure (7 sections)**:

1. Product Requirements (What, Why, Success, Out of Scope)
2. Context & Codebase Intelligence
3. Technical Specifications
4. Implementation Runbook
5. Validation Loops
6. Risk Mitigation
7. References

#### 2. Feature Branch Setup (Script)

**What**: Convert PRP to feature branch
**Command**: `./scripts/prp-to-feature.sh <feature-name> <number>`
**Output**: Branch created, PRP copied to `docs/specs/<branch>/spec.md`

```bash
# Example
./scripts/prp-to-feature.sh visual-regression 012

# Creates:
# - Branch: 012-visual-regression
# - File: docs/specs/012-visual-regression/spec.md (PRP copied)
# - Updates: docs/prp-docs/PRP-STATUS.md (status → "In Progress")
```

#### 3. Specification Generation (`/specify`)

**What**: Convert PRP to SpecKit-formatted specification
**Command**: `/specify <feature description>`
**Output**: `docs/specs/<branch>/spec.md` (SpecKit format)

**PRP Format vs SpecKit Format**:

| Aspect    | PRP                       | SpecKit Spec                             |
| --------- | ------------------------- | ---------------------------------------- |
| Focus     | Product (WHAT/WHY)        | Implementation (testable requirements)   |
| Audience  | Stakeholders              | Developers                               |
| Structure | 7 flexible sections       | Fixed template (User Scenarios, FR, NFR) |
| Details   | Can include code examples | Conceptual only                          |
| Format    | Narrative                 | Given/When/Then + FR-001 style           |

**What `/specify` Does**:

- Extracts "What We're Building" → Primary User Story
- Converts "Why" bullets → User value scenarios
- Maps "Success Criteria" → Success Metrics (SM-001, ...)
- Extracts requirements → Functional Requirements (FR-001, ...)
- Identifies constraints → Non-Functional Requirements (NFR-001, ...)
- Marks unknowns → `[NEEDS CLARIFICATION: ...]`

#### 4. Clarification (Optional - `/clarify`)

**What**: Resolve ambiguities in specification
**Command**: `/clarify`
**Output**: Updated `docs/specs/<branch>/spec.md` with Clarifications section

**When to Use**:

- Spec contains `[NEEDS CLARIFICATION]` markers
- Requirements are vague or ambiguous
- Multiple interpretation possible

**What It Does**:

- Scans spec against taxonomy (10 categories)
- Asks up to 5 targeted questions
- Updates spec with answers
- Removes ambiguity before planning

**Best Practice**: Run before `/plan` if any uncertainties exist.

#### 5. Implementation Planning (`/plan`)

**What**: Generate technical implementation plan and design artifacts
**Command**: `/plan <optional technical context>`
**Output**: Multiple files in `docs/specs/<branch>/`

**Generated Artifacts**:

1. **plan.md** - Main implementation plan
   - Architecture overview
   - Tech stack decisions
   - File structure
   - Implementation phases
   - Constitution check

2. **research.md** - Technical research (Phase 0)
   - Library comparisons
   - Architecture decisions
   - Trade-off analysis

3. **data-model.md** - Entity definitions (Phase 1)
   - Database schemas
   - Data relationships
   - Validation rules

4. **contracts/** - API specifications (Phase 1, if applicable)
   - OpenAPI/YAML specs
   - Request/response formats
   - Error codes

5. **quickstart.md** - Integration scenarios (Phase 1)
   - User flows
   - Test scenarios
   - Setup instructions

**Constitution Check**: `/plan` validates against 6 core principles before proceeding.

#### 6. Task Breakdown (`/tasks`)

**What**: Convert plan into actionable, dependency-ordered tasks
**Command**: `/tasks <optional context>`
**Output**: `docs/specs/<branch>/tasks.md`

**Task Categories**:

- **Setup**: Project init, dependencies, linting
- **Test Tasks [P]**: Contract tests, integration tests (parallel)
- **Core**: Models, services, endpoints (sequential if shared files)
- **Integration**: DB connections, middleware, logging
- **Polish Tasks [P]**: Unit tests, performance, docs (parallel)

**Task Features**:

- Numbered (T001, T002, ...)
- Dependency-ordered
- `[P]` markers for parallel execution
- File paths specified
- Acceptance criteria per task

#### 7. Implementation (`/implement`)

**What**: Execute tasks following TDD principles
**Command**: `/implement`
**Output**: Fully implemented feature with tests

**Execution Rules**:

- Setup first
- Tests before code (TDD)
- Respect dependencies (sequential vs parallel)
- File-based coordination (same file = sequential)
- Validate each phase

**Marks tasks complete**: Changes `[ ]` to `[X]` in tasks.md

#### 8. Analysis (Optional - `/analyze`)

**What**: Cross-artifact consistency check
**Command**: `/analyze`
**Output**: Markdown report (read-only)

**Checks**:

- Requirement coverage (do all FR have tasks?)
- Duplication detection
- Ambiguity detection
- Constitution alignment
- Coverage gaps
- Terminology consistency

**When to Use**: After `/tasks`, before `/implement`

---

### Complete Workflow Example

**Scenario**: Implement PRP-012 (Visual Regression Testing)

```bash
# 1. Write PRP (manual)
vim docs/prp-docs/visual-regression-testing-prp.md
# ... write 7 sections ...

# 2. Create feature branch
./scripts/prp-to-feature.sh visual-regression 012
# Creates branch: 012-visual-regression
# Copies PRP to docs/specs/012-visual-regression/spec.md

# 3. Generate specification
/specify Visual regression testing with Chromatic for Storybook themes
# Generates: docs/specs/012-visual-regression/spec.md (SpecKit format)
# - User scenarios (Given/When/Then)
# - FR-001 through FR-008
# - NFR-001 through NFR-003
# - Success metrics (SM-001, SM-002)

# 4. Clarify (if needed)
/clarify
# Asks questions if ambiguities found
# Updates spec.md with clarifications

# 5. Generate implementation plan
/plan Focus on Storybook integration, test 4 themes initially
# Generates: plan.md, research.md, data-model.md, quickstart.md
# - Architecture: Chromatic vs Percy comparison
# - Tech stack: Chromatic selected
# - File structure: .storybook/, .github/workflows/
# - Phases: Setup → Configuration → Stories → CI

# 6. Generate tasks
/tasks
# Generates: tasks.md with 20 numbered tasks
# - T001-T003: Setup (Chromatic account, install, config)
# - T004-T008: [P] Story updates (parallel)
# - T009-T015: Configuration (Storybook, GitHub Actions)
# - T016-T020: [P] Validation (parallel)

# 7. Analyze (optional quality check)
/analyze
# Report: 100% coverage, 0 issues, ready to implement

# 8. Implement
/implement
# Executes tasks T001-T020
# Marks complete: [X] in tasks.md
# Creates: Chromatic config, updated stories, CI workflow

# 9. Validate
docker compose exec scripthammer pnpm run test:suite
# All tests pass

# 10. Commit and PR
git add .
git commit -m "feat: Add visual regression testing with Chromatic (PRP-012)"
git push origin 012-visual-regression
# Create PR via GitHub
```

**Result**: PRP-012 complete, merged to main

---

### PRP vs SpecKit: What Goes Where?

| Information               | PRP Document       | SpecKit Spec       | Implementation Plan         |
| ------------------------- | ------------------ | ------------------ | --------------------------- |
| **Business value**        | ✅ Why section     | User stories       | N/A                         |
| **User needs**            | ✅ What section    | User scenarios     | N/A                         |
| **Success criteria**      | ✅ Checkboxes      | Success metrics    | Validation method           |
| **Code examples**         | ✅ Context section | ❌ Avoid           | ✅ File structure           |
| **Library choices**       | ✅ Dependencies    | ❌ Avoid           | ✅ Tech stack               |
| **Implementation steps**  | ✅ Runbook         | ❌ Avoid           | ✅ Phases                   |
| **Testable requirements** | ❌ High-level      | ✅ FR-001, NFR-001 | ✅ Task acceptance criteria |
| **Architecture**          | ❌ Optional        | ❌ Avoid           | ✅ Design section           |

**Key Insight**: PRPs provide **product context**, SpecKit provides **implementation structure**.

---

### Integration with Original Workflow

**Backward Compatibility**: The original PRP workflow (manual planning) still works. SpecKit is an **enhancement**, not a replacement.

**Migration Path**:

1. Continue using PRPs for product thinking
2. Add SpecKit commands for automation
3. Gradually adopt `/specify` → `/plan` → `/tasks` sequence
4. Keep manual control where needed

**When to Skip SpecKit**:

- Emergency hotfixes (no time for process)
- Trivial changes (<2 hours work)
- Experimental spikes (throwaway code)

---

### Quick Reference

**Full Guide**: See [SPECKIT-PRP-GUIDE.md](./SPECKIT-PRP-GUIDE.md) for comprehensive quick reference.

**Command Sequence**:

```
prp-to-feature.sh → /specify → /clarify → /plan → /tasks → /implement → /analyze
```

**Key Files**:

- PRP: `docs/prp-docs/<name>-prp.md`
- Spec: `docs/specs/<branch>/spec.md`
- Plan: `docs/specs/<branch>/plan.md`
- Tasks: `docs/specs/<branch>/tasks.md`

---

## Using `/plan` with PRPs (Legacy Section)

_Note: This section describes the original manual workflow. See "SpecKit Integration" above for the current automated approach._

1. Create feature branch with sequential numbering
2. Copy PRP content to `docs/specs/[branch-name]/spec.md`
3. Run `/plan` to generate implementation plan
4. Review and adjust generated plan

## Using `/specify` for refinement (Legacy Section)

_Note: `/specify` is now the primary command, not just for refinement. See "SpecKit Integration" above._

1. Use when PRP needs additional specification
2. Generates detailed technical requirements
3. Updates feature spec with clarifications

## Using `/tasks` for execution (Legacy Section)

_Note: `/tasks` is now part of the full workflow. See "SpecKit Integration" above._

1. Run after `/plan` completes
2. Generates ordered task list from plan
3. Creates `tasks.md` with checkboxes
4. Follow TDD approach (tests first)

## Automation Scripts

### PRP to Feature Branch Script

```bash
#!/bin/bash
# scripts/prp-to-feature.sh

PRP_NAME=$1
BRANCH_NUMBER=$2
BRANCH_NAME="${BRANCH_NUMBER}-${PRP_NAME}"

# Create and checkout branch
git checkout -b $BRANCH_NAME

# Setup feature directory
mkdir -p docs/specs/$BRANCH_NAME
cp docs/prp-docs/${PRP_NAME}-prp.md docs/specs/$BRANCH_NAME/spec.md

# Run plan command
./plan

echo "Feature branch $BRANCH_NAME created from PRP"
echo "Run ./tasks to generate task list"
```

## Best Practices

### 1. Sequential Processing

- Complete each PRP before starting the next
- Exception: Independent PRPs in Phase 5 can be parallel

### 2. Dependency Management

- Verify all dependencies are complete before starting
- Document any new dependencies discovered during implementation

### 3. Testing Requirements

- Each PRP must include tests as defined in constitution
- TDD approach: Write tests first, then implementation

### 4. Documentation

- Update this workflow document with lessons learned
- Keep PRP status current
- Document any deviations from planned sequence

### 5. Review Process

- Each PRP completion requires code review
- Update constitution if new principles emerge
- Capture reusable patterns for future PRPs

## Rollback Procedures

If a PRP implementation causes issues:

1. **Immediate Rollback**

   ```bash
   git checkout main
   git revert <merge-commit>
   ```

2. **Update Status**
   - Mark PRP as "⏸️ Blocked" with reason
   - Document issues in PRP-STATUS.md

3. **Fix and Retry**
   - Create new branch with same number
   - Address identified issues
   - Re-run through workflow

## Success Metrics

### Per PRP

- [ ] Implementation matches PRP requirements
- [ ] All tests passing
- [ ] No regression in existing features
- [ ] Documentation complete

### Overall

- [ ] All 14 PRPs successfully implemented
- [ ] Constitution principles maintained
- [ ] Codebase remains maintainable
- [ ] Clear audit trail of changes

---

**Next Steps**: Begin with `001-prp-methodology` to establish the PRP workflow system.
