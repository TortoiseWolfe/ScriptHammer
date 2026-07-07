# Research: PRP Methodology & SpecKit Integration

**Feature**: 001-prp-methodology
**Phase**: 0 - Research
**Date**: 2025-09-30

## Research Questions

1. How do SpecKit commands work together?
2. What is the PRP format structure?
3. How have previous PRPs been implemented?
4. What are the integration points between PRPs and SpecKit?

---

## SpecKit Command Analysis

### Command Flow

```
/specify → /clarify → /plan → /tasks → /implement → /analyze
```

**Sequential Dependencies**:

- `/clarify` requires `/specify` output (spec.md)
- `/plan` requires `/specify` output (spec.md)
- `/tasks` requires `/plan` output (plan.md, artifacts)
- `/implement` requires `/tasks` output (tasks.md)
- `/analyze` requires all three (spec.md, plan.md, tasks.md)

### Command Details

#### 1. `/specify` Command

**Purpose**: Convert natural language description into structured specification

**Input**: Feature description (user argument)

**Process**:

1. Runs `.specify/scripts/bash/create-new-feature.sh --json`
2. Loads `.specify/templates/spec-template.md`
3. Generates spec.md with:
   - User Scenarios (Given/When/Then)
   - Functional Requirements (FR-001, FR-002, ...)
   - Non-Functional Requirements (NFR-001, ...)
   - Key Entities
   - Success Metrics

**Output**: `specs/<branch>/spec.md`

**Template Structure** (from `.specify/templates/spec-template.md`):

- Execution Flow (validation steps)
- Quick Guidelines (focus on WHAT/WHY, avoid HOW)
- User Scenarios & Testing (mandatory)
- Requirements (mandatory)
- Key Entities (if data involved)
- Review & Acceptance Checklist
- Execution Status tracking

#### 2. `/clarify` Command

**Purpose**: Identify underspecified areas and ask targeted questions

**Input**: Existing spec.md

**Process**:

1. Runs `.specify/scripts/bash/check-prerequisites.sh --json --paths-only`
2. Scans spec for ambiguities using taxonomy:
   - Functional Scope & Behavior
   - Domain & Data Model
   - Interaction & UX Flow
   - Non-Functional Quality Attributes
   - Integration & External Dependencies
   - Edge Cases & Failure Handling
   - Constraints & Tradeoffs
   - Terminology & Consistency
   - Completion Signals
   - Misc / Placeholders
3. Asks up to 5 targeted questions (one at a time)
4. Updates spec.md with clarifications

**Output**: Updated `specs/<branch>/spec.md` with Clarifications section

**When to Use**: Before `/plan` if ambiguities exist

#### 3. `/plan` Command

**Purpose**: Generate implementation plan and design artifacts

**Input**: spec.md

**Process**:

1. Runs `.specify/scripts/bash/setup-plan.sh --json`
2. Loads `.specify/templates/plan-template.md`
3. Reads constitution (`.specify/memory/constitution.md`)
4. Executes 9-phase planning workflow:
   - **Phase 0**: Research (technical decisions)
   - **Phase 1**: Design artifacts (data-model, contracts, quickstart)
   - **Phase 2**: Task planning (NOT execution)
5. Constitution Check (before and after design)

**Outputs**:

- `specs/<branch>/plan.md` - Main implementation plan
- `specs/<branch>/research.md` - Phase 0 technical research
- `specs/<branch>/data-model.md` - Phase 1 entities/schemas
- `specs/<branch>/contracts/` - Phase 1 API specs (if applicable)
- `specs/<branch>/quickstart.md` - Phase 1 integration scenarios

**Stops At**: Phase 2 planning (does NOT create tasks.md)

#### 4. `/tasks` Command

**Purpose**: Break plan into actionable, dependency-ordered tasks

**Input**: plan.md, data-model.md, contracts/, quickstart.md

**Process**:

1. Runs `.specify/scripts/bash/check-task-prerequisites.sh --json`
2. Analyzes all available artifacts
3. Loads `.specify/templates/tasks-template.md`
4. Generates ordered task list with:
   - **Setup Tasks**: Project init, dependencies
   - **Test Tasks [P]**: Contract tests, integration tests
   - **Core Implementation**: Models, services, endpoints
   - **Integration Tasks**: DB, middleware, logging
   - **Polish Tasks [P]**: Unit tests, performance, docs

**Output**: `specs/<branch>/tasks.md`

**Task Features**:

- Numbered (T001, T002, ...)
- Ordered by dependencies
- `[P]` markers for parallel execution
- File paths specified
- Acceptance criteria per task

#### 5. `/implement` Command

**Purpose**: Execute tasks following TDD principles

**Input**: tasks.md, plan.md, all artifacts

**Process**:

1. Runs `.specify/scripts/bash/check-implementation-prerequisites.sh --json`
2. Loads task list and analyzes dependencies
3. Executes tasks phase-by-phase:
   - Setup first
   - Tests before code (TDD)
   - Respect dependencies
   - Parallel when possible `[P]`
   - Validate each phase
4. Marks completed tasks with `[X]`

**Output**: Fully implemented feature with tests

**Execution Rules**:

- TDD mandatory (tests first)
- Sequential tasks in order
- File-based coordination (same file = sequential)
- Validation checkpoints

#### 6. `/analyze` Command

**Purpose**: Cross-artifact consistency check (read-only)

**Input**: spec.md, plan.md, tasks.md

**Process**:

1. Runs `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`
2. Builds semantic models of all artifacts
3. Detection passes:
   - Duplication detection
   - Ambiguity detection
   - Underspecification
   - Constitution alignment
   - Coverage gaps
   - Inconsistency
4. Severity assignment (CRITICAL, HIGH, MEDIUM, LOW)

**Output**: Markdown report (no file writes)

**When to Use**: After `/tasks`, before `/implement`

---

## PRP Format Structure

### 7-Section Pattern (from visual-regression-testing-prp.md)

#### 1. Product Requirements

- **What We're Building**: 1-2 sentence description
- **Why We're Building It**: Business/user value (3-5 bullets)
- **Success Criteria**: Measurable outcomes (checkboxes)
- **Out of Scope**: Explicitly state what's NOT included

#### 2. Context & Codebase Intelligence

- **Existing Patterns to Follow**: Code examples from codebase
- **Dependencies & Libraries**: Specific versions, installation commands
- **File Structure**: Show where code goes

#### 3. Technical Specifications

- **Implementation approach**: With code snippets
- **Architecture diagrams**: If complex
- **Configuration examples**: Actual config files

#### 4. Implementation Runbook

- **Step-by-step execution**: Numbered steps
- **Bash commands with examples**: Copy-pasteable
- **Expected outputs**: What to expect at each step

#### 5. Validation Loops

- **Pre-implementation checks**: Checkboxes
- **During implementation checks**: Continuous validation
- **Post-implementation verification**: Final checks

#### 6. Risk Mitigation

- **List potential risks**: Specific risks
- **Mitigation strategy for each**: Actionable mitigations

#### 7. References

- **Internal docs**: Links to codebase files
- **External resources**: Documentation URLs
- **Related PRPs**: Cross-references

### PRP vs. SpecKit Spec Comparison

| Aspect               | PRP Format                     | SpecKit Spec Format                                     |
| -------------------- | ------------------------------ | ------------------------------------------------------- |
| **Focus**            | Product thinking (WHAT/WHY)    | Implementation detail (testable requirements)           |
| **Structure**        | 7 sections (flexible)          | Fixed template (User Scenarios, Requirements, Entities) |
| **Audience**         | Product managers, stakeholders | Developers, implementers                                |
| **Tech Details**     | Can include (Context section)  | Avoid (defer to planning)                               |
| **Examples**         | Code snippets encouraged       | Conceptual only                                         |
| **Success Criteria** | Business outcomes              | Measurable, testable criteria                           |
| **Format**           | Narrative + code blocks        | Given/When/Then + FR-001 style                          |

### Conversion Process

**PRP → SpecKit Spec**:

1. Extract "What We're Building" → Primary User Story
2. Convert "Why" bullets → User value scenarios
3. Map "Success Criteria" → Success Metrics (SM-001, ...)
4. Extract requirements → Functional Requirements (FR-001, ...)
5. Identify constraints → Non-Functional Requirements (NFR-001, ...)
6. Technical Specs context → Assumptions section
7. Mark any unknowns → [NEEDS CLARIFICATION: ...]

---

## Completed PRP Analysis

### PRP-010: EmailJS Integration

**Status**: ✅ Completed 2025-01-17
**Test Coverage**: 100%
**Key Patterns**:

- Provider pattern with automatic failover
- Retry logic with exponential backoff
- Rate limiting
- TDD approach throughout

**Workflow**:

1. PRP written with 7 sections
2. Converted to feature branch
3. Implemented with comprehensive tests
4. Completion report created

**Files Created**:

- `/src/services/email/providers/emailjs.ts`
- `/src/services/email/email-service.ts`
- Comprehensive test suite

**Lessons**:

- Clear PRP structure led to smooth implementation
- TDD approach caught edge cases early
- 100% coverage achievable with good planning

### PRP-013: Calendar Integration

**Status**: ✅ Completed 2025-09-17
**Key Patterns**:

- Third-party service integration
- GDPR consent modal before loading
- Dual provider support (Calendly, Cal.com)
- Dynamic imports for code splitting

**Workflow**:

1. PRP defined integration requirements
2. GDPR compliance identified early
3. Implementation followed consent pattern

**Lessons**:

- Privacy-first design from PRP stage
- Consent modal pattern reusable
- Third-party services need extra validation

### PRP-014: Geolocation Map

**Status**: ✅ Completed 2025-09-18
**Key Patterns**:

- Leaflet.js integration
- GDPR consent before location access
- Dynamic loading (SSR disabled)
- Desktop vs mobile accuracy differences

**Known Limitation**: Desktop browsers use IP-based geolocation (city-level accuracy)

**Workflow**:

1. PRP identified geolocation requirements
2. Privacy implications caught in PRP stage
3. Desktop limitation documented as PRP-015 future enhancement

**Lessons**:

- Geolocation requires explicit consent
- Platform differences need research upfront
- Known limitations should be documented, not hidden

---

## Integration Points

### PRP-to-Feature Script

**Location**: `scripts/prp-to-feature.sh`

**Purpose**: Convert PRP document into feature branch

**Usage**:

```bash
./scripts/prp-to-feature.sh <prp-name> <branch-number>
```

**What It Does**:

1. Checks current branch (warns if not main)
2. Verifies PRP file exists in `docs/prp-docs/`
3. Creates feature branch `<number>-<name>`
4. Copies PRP to `specs/<branch>/spec.md`
5. Updates `docs/prp-docs/PRP-STATUS.md` to "In Progress"

**Output**:

- New branch created and checked out
- Initial spec.md from PRP
- Status tracking updated

### PRP Status Tracking

**Location**: `docs/prp-docs/PRP-STATUS.md`

**Purpose**: Dashboard of all PRPs

**Content**:

- Last updated date
- Total PRPs, completed, pending
- Current phase
- Quick status overview (progress bars)
- Detailed table (PRP #, priority, status, branch, dates)
- Metrics (velocity, quality)
- Lessons learned
- Next actions

**Statuses**:

- 📥 Inbox: Not started
- 🚀 Ready: Dependencies met
- 🔄 In Progress: Active development
- 🔍 In Review: PR submitted
- ✅ Completed: Merged
- ⏸️ Blocked: Issues encountered
- 🔙 Rolled Back: Reverted

---

## Key Findings

### 1. SpecKit Scripts May Not Exist

- Commands reference `.specify/scripts/bash/*.sh`
- These scripts may not be in all repositories
- Workflow can proceed without them (manual path resolution)

### 2. Template Structure is Self-Documenting

- Templates in `.specify/templates/` are comprehensive
- Each template has execution flow built-in
- Templates guide artifact generation

### 3. PRPs Predate SpecKit

- 12 PRPs completed before full SpecKit integration
- Successful without SpecKit (sequential workflow)
- SpecKit formalizes what was done manually

### 4. Constitution is Central

- All planning checks constitution alignment
- Constitution in `.specify/memory/constitution.md`
- 6 core principles guide all decisions

### 5. Dogfooding Opportunity

- PRP-001 can demonstrate the full workflow
- Going through SpecKit commands documents them
- Meta: documenting by doing

---

## Recommendations

### For PRP-001 Implementation

1. **Create Comprehensive PRP First**
   - Use visual-regression-testing-prp.md as template
   - Include all 7 sections
   - Focus on documentation requirements, not code

2. **Run Full SpecKit Workflow**
   - `/specify` to convert PRP format
   - `/clarify` if ambiguities (likely none for docs)
   - `/plan` to create this research and artifacts
   - `/tasks` to break down documentation work
   - `/implement` or manual execution

3. **Use Real Examples**
   - Reference PRPs 010, 013, 014
   - Show before/after conversion
   - Include actual file paths

4. **Create Quick Reference**
   - One-page cheat sheet
   - Command sequence diagram
   - Artifact mapping table
   - Common pitfalls

5. **Update Existing Docs**
   - Add SpecKit section to PRP-WORKFLOW.md
   - Link from CLAUDE.md
   - Ensure discoverability

---

## Technical Decisions

### Decision: Use Markdown

**Rationale**: Already in use, no build step, version controlled, readable on GitHub

### Decision: Location in docs/prp-docs/

**Rationale**: Existing PRP docs there, keeps related docs together, discoverable

### Decision: Real Examples Over Hypotheticals

**Rationale**: Constitution requirement (NFR-002), verifiable, shows real complexity

### Decision: Dogfood the Workflow

**Rationale**: Best demonstration is using it, self-documenting, validates process

---

## Open Questions

✅ **Resolved**:

- How do SpecKit commands integrate? → Sequential workflow with artifacts
- What's the PRP structure? → 7 sections documented
- How have PRPs been implemented? → Analyzed 3 completed PRPs
- What's the conversion process? → PRP → SpecKit spec mapping clear

**None Remaining**: All research questions answered.

---

**Phase 0 Complete**: Ready for Phase 1 (design artifacts)
