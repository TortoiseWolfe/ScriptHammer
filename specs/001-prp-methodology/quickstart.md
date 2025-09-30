# Quick Reference: PRP/SpecKit Workflow

**Feature**: 001-prp-methodology
**Purpose**: Fast lookup guide for PRP/SpecKit workflow
**Audience**: Developers implementing features

---

## 📋 Command Cheat Sheet

```bash
# 1. Create PRP document
vim docs/prp-docs/<feature-name>-prp.md

# 2. Convert to feature branch
./scripts/prp-to-feature.sh <feature-name> <number>

# 3. Run SpecKit workflow
/specify <feature description>
/clarify  # Optional: if ambiguities exist
/plan <optional technical context>
/tasks <optional context>
/implement  # Or execute manually

# 4. Optional: Check consistency
/analyze
```

---

## 🔄 Workflow Diagram

```
[Write PRP]
    ↓
[prp-to-feature.sh]
    ↓
[/specify] → spec.md
    ↓
[/clarify] (optional) → updated spec.md
    ↓
[/plan] → plan.md + research.md + data-model.md + quickstart.md
    ↓
[/tasks] → tasks.md
    ↓
[/implement or manual] → code + tests
    ↓
[/analyze] (optional) → consistency report
    ↓
[Commit & PR]
```

---

## 📁 Artifact Map

| Command             | Generates           | Location                       | Purpose                   |
| ------------------- | ------------------- | ------------------------------ | ------------------------- |
| `prp-to-feature.sh` | Initial spec        | `specs/<branch>/spec.md`       | PRP copied to specs dir   |
| `/specify`          | Specification       | `specs/<branch>/spec.md`       | SpecKit-formatted spec    |
| `/clarify`          | Clarifications      | `specs/<branch>/spec.md`       | Resolves ambiguities      |
| `/plan`             | Implementation plan | `specs/<branch>/plan.md`       | Main planning doc         |
| `/plan` (Phase 0)   | Research            | `specs/<branch>/research.md`   | Technical decisions       |
| `/plan` (Phase 1)   | Data model          | `specs/<branch>/data-model.md` | Entities & relationships  |
| `/plan` (Phase 1)   | Quickstart          | `specs/<branch>/quickstart.md` | Integration scenarios     |
| `/plan` (Phase 1)   | Contracts           | `specs/<branch>/contracts/`    | API specs (if applicable) |
| `/tasks`            | Task list           | `specs/<branch>/tasks.md`      | Numbered, ordered tasks   |
| `/implement`        | Code & tests        | `src/`, tests/                 | Implementation            |
| `/analyze`          | Report              | Console output                 | Consistency check         |

---

## 🎯 When to Use Full Workflow

### ✅ Use PRP/SpecKit for:

- New features (complexity: medium to high)
- Significant refactoring or architecture changes
- External service integrations
- Features requiring multiple components
- Anything taking >1 day to implement
- Features with unclear requirements

### ❌ Skip workflow for:

- Bug fixes (unless architectural)
- Typo corrections
- Documentation updates (unless substantial)
- Dependency version bumps
- Simple styling changes
- Anything taking <2 hours

---

## 📝 PRP 7-Section Structure

```markdown
# Product Requirements Prompt (PRP)

**Feature Name**: [Name]
**Priority**: P0/P1/P2/P3
**Status**: 📥 Inbox
**Created**: [Date]

---

## 1. Product Requirements

- What We're Building
- Why We're Building It
- Success Criteria
- Out of Scope

## 2. Context & Codebase Intelligence

- Existing Patterns to Follow
- Dependencies & Libraries
- File Structure

## 3. Technical Specifications

- Implementation approach
- Code examples
- Configuration

## 4. Implementation Runbook

- Step-by-step execution
- Bash commands
- Expected outputs

## 5. Validation Loops

- Pre-implementation checks
- During implementation checks
- Post-implementation verification

## 6. Risk Mitigation

- List potential risks
- Mitigation strategy for each

## 7. References

- Internal docs
- External resources
- Related PRPs
```

---

## 🔍 SpecKit Spec Structure

```markdown
# Feature Specification: [Name]

## User Scenarios & Testing

- Primary User Story
- Acceptance Scenarios (Given/When/Then)
- Edge Cases

## Requirements

- Functional Requirements (FR-001, FR-002, ...)
- Non-Functional Requirements (NFR-001, ...)
- Key Entities
- Success Metrics (SM-001, ...)

## Scope & Boundaries

- In Scope
- Out of Scope
- Dependencies
- Assumptions

## Risks & Mitigations
```

---

## 🚦 Common Patterns

### Pattern 1: New Component Feature

```bash
# 1. Write PRP with component structure requirements
# 2. Run workflow
./scripts/prp-to-feature.sh my-component 023
/specify New atomic button component with variants
/plan Use component generator, follow 5-file pattern
/tasks
# 3. Execute
docker compose exec scripthammer pnpm run generate:component MyButton
# ... implement following tasks.md
```

### Pattern 2: External Service Integration

```bash
# 1. Write PRP emphasizing privacy/consent
# 2. Run workflow with GDPR context
./scripts/prp-to-feature.sh analytics-service 024
/specify Analytics integration with GDPR compliance
/plan Consent modal required before loading service
/tasks
# 3. Implement consent flow first, then integration
```

### Pattern 3: Documentation Feature

```bash
# 1. Write PRP focused on docs, not code
# 2. Run workflow
./scripts/prp-to-feature.sh feature-docs 025
/specify Documentation for [feature] with examples
/plan Markdown files, real examples from codebase
/tasks
# 3. Write docs following style guide
```

---

## ⚠️ Common Pitfalls

| Pitfall                              | Solution                                      |
| ------------------------------------ | --------------------------------------------- |
| Writing HOW in PRP                   | PRPs are WHAT/WHY, leave HOW for planning     |
| Skipping `/specify`                  | Always convert PRP format to SpecKit format   |
| Running `/plan` before `/specify`    | Follow sequence: specify → plan → tasks       |
| Creating components manually         | Use `pnpm run generate:component`             |
| Marking tasks complete without tests | TDD required - test first, then implement     |
| Ignoring `[NEEDS CLARIFICATION]`     | Resolve all ambiguities before planning       |
| Not using `[P]` markers              | Mark parallel tasks to enable concurrent work |

---

## 🎓 Real Examples

### Example 1: PRP-010 (EmailJS Integration)

**PRP Structure**:

- What: Backup email service with failover
- Why: Redundancy for critical contact forms
- Success: 100% test coverage, <3s response time

**Workflow**:

1. PRP written with provider pattern
2. `/specify` → Generated spec with FR-001 through FR-008
3. `/plan` → Provider abstraction, retry logic, rate limiting
4. `/tasks` → 15 tasks (setup, tests, implementation, polish)
5. `/implement` → 100% coverage achieved

**Result**: Production-ready email service in 1 day

### Example 2: PRP-013 (Calendar Integration)

**PRP Structure**:

- What: Embedded scheduling (Calendly/Cal.com)
- Why: User convenience, professional appearance
- Success: GDPR compliant, <150KB bundle impact

**Workflow**:

1. PRP identified privacy implications early
2. `/specify` → User scenarios with consent flow
3. `/clarify` → Which calendar providers? (answered: both)
4. `/plan` → Dynamic imports, consent modal pattern
5. `/tasks` → 12 tasks (consent UI, provider integration, tests)

**Result**: GDPR-compliant calendar integration

### Example 3: PRP-001 (This Feature!)

**PRP Structure**:

- What: PRP/SpecKit methodology documentation
- Why: Enable repeatable feature development
- Success: PRP-012 implementable using docs

**Workflow**:

1. PRP written with 7 sections (prp-methodology-prp.md)
2. `/specify` → Generated spec with 13 FR, 5 NFR
3. `/clarify` → No ambiguities detected (comprehensive PRP)
4. `/plan` → Documentation strategy, real examples
5. `/tasks` → Documentation writing tasks
6. Manual execution → This quickstart guide you're reading!

**Result**: Demonstrates workflow by using it (dogfooding)

---

## 📊 Task Structure

```markdown
## Setup Tasks

- T001: [Setup item 1]
- T002: [Setup item 2]

## Test Tasks [P]

- T003: [P] Create test A
- T004: [P] Create test B (parallel with T003)

## Core Implementation

- T005: Implement feature A (depends on T003)
- T006: Implement feature B (depends on T004)

## Integration Tasks

- T007: Integrate A + B (depends on T005, T006)

## Polish Tasks [P]

- T008: [P] Documentation
- T009: [P] Performance optimization
```

**Key**:

- `[P]` = Can run in parallel (different files, independent)
- No `[P]` = Must run sequentially (dependencies or shared files)
- `T###` = Task number for tracking

---

## 🔬 Testing the Workflow

**Validation Test**: Can you implement PRP-012?

```bash
# 1. Read documentation
cat docs/prp-docs/prp-methodology-prp.md
cat docs/prp-docs/SPECKIT-PRP-GUIDE.md

# 2. Write PRP for Visual Regression
vim docs/prp-docs/visual-regression-testing-prp.md

# 3. Run workflow
./scripts/prp-to-feature.sh visual-regression 012
/specify Visual regression testing with Chromatic
/plan Focus on Storybook integration, test 4 themes
/tasks
# Execute tasks...

# 4. Success criteria
# - Did you complete PRP-012 without external help?
# - Did documentation answer your questions?
# - Were examples clear and helpful?
```

---

## 🔗 Related Documentation

- **Comprehensive Guide**: `docs/prp-docs/prp-methodology-prp.md`
- **PRP Workflow**: `docs/prp-docs/PRP-WORKFLOW.md`
- **PRP Status Dashboard**: `docs/prp-docs/PRP-STATUS.md`
- **Constitution**: `.specify/memory/constitution.md`
- **SpecKit Templates**: `.specify/templates/`
- **Project Instructions**: `CLAUDE.md`

---

## 🆘 Troubleshooting

### Issue: `/specify` says spec already exists

**Solution**: You're on a feature branch with existing spec.md. Either delete it or use different branch.

### Issue: No SpecKit scripts found

**Solution**: SpecKit scripts may not be in all repos. Commands work without them (manual path resolution).

### Issue: PRP too vague, SpecKit can't generate concrete spec

**Solution**: Use `/clarify` to identify gaps. Iterate on PRP until clear.

### Issue: Generated tasks have circular dependencies

**Solution**: Review tasks.md, manually reorder if needed. Report issue for template improvement.

### Issue: Don't know if feature needs full workflow

**Solution**: Use decision tree above. When in doubt, use workflow (better documented than undocumented).

---

**Quick Reference Complete**: Copy this when implementing PRPs!
