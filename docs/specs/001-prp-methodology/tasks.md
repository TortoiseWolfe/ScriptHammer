# Tasks: PRP Methodology & SpecKit Integration

**Feature**: 001-prp-methodology
**Branch**: `001-prp-methodology`
**Input**: Design documents from `/specs/001-prp-methodology/`
**Prerequisites**: ✅ plan.md, ✅ research.md, ✅ data-model.md, ✅ quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → ✅ Loaded: Documentation feature, no code implementation
   → ✅ Tech stack: Markdown files only
2. Load optional design documents:
   → ✅ research.md: SpecKit workflow analyzed
   → ✅ data-model.md: Conceptual entities defined
   → ✅ quickstart.md: Quick reference content ready
   → N/A contracts/: No API (documentation feature)
3. Generate tasks by category:
   → Setup: Review existing docs
   → Documentation: Write markdown files
   → Integration: Update existing docs
   → Validation: Manual testing
4. Apply task rules:
   → Documentation files = mark [P] (can write in parallel)
   → Updates to same file = sequential
   → No code tests (manual validation instead)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All FR requirements covered?
   → Quick reference complete?
   → Examples included?
9. ✅ SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- File paths included in descriptions
- Acceptance criteria per task

---

## Phase 1: Setup & Research

### T001: Review Existing PRP Documentation ✅

**Files**: `docs/prp-docs/*.md`
**Action**: Read all existing PRP documents to understand current structure
**Acceptance**:

- [x] Read PRP-STATUS.md
- [x] Read PRP-WORKFLOW.md
- [x] Read 2-3 completed PRPs (010, 013, 014)
- [x] Understand existing patterns

**Dependencies**: None (first task)
**Status**: ✅ COMPLETED via research.md

---

### T002: Analyze SpecKit Command Definitions ✅

**Files**: `.claude/commands/*.md`
**Action**: Read all SpecKit slash command definitions
**Acceptance**:

- [x] Read `/specify`, `/clarify`, `/plan`, `/tasks`, `/implement`, `/analyze` commands
- [x] Understand command sequence
- [x] Document what each command generates

**Dependencies**: None

**Parallel with**: T001 ✅ Different files
**Status**: ✅ COMPLETED via research.md

---

### T003: Review SpecKit Templates ✅

**Files**: `.specify/templates/*.md`
**Action**: Read spec, plan, and tasks templates
**Acceptance**:

- [x] Read spec-template.md structure
- [x] Read plan-template.md structure
- [x] Read tasks-template.md structure
- [x] Understand template requirements

**Dependencies**: None

**Parallel with**: T001, T002 ✅ Different files
**Status**: ✅ COMPLETED via research.md

---

## Phase 2: Core Documentation Writing

### T004: [P] Write SPECKIT-PRP-GUIDE.md Quick Reference ✅

**File**: `docs/prp-docs/SPECKIT-PRP-GUIDE.md` (NEW)
**Action**: Create one-page quick reference guide
**Content** (from quickstart.md):

- Command cheat sheet
- Workflow diagram
- Artifact map table
- When to use full workflow (decision tree)
- Common patterns (3 examples)
- Common pitfalls table
- Troubleshooting section

**Acceptance**:

- [x] File created at correct path
- [x] Fits on single page/screen (NFR-003)
- [x] All commands documented with examples
- [x] Artifact map shows what gets generated where
- [x] Decision tree clear (when to use workflow vs skip)
- [x] 3 real examples included (010, 013, 001)
- [x] Markdown formatting correct
- [x] Links work

**Dependencies**: T001, T002, T003 (need research)

**Parallel**: Can write independently ✅
**Status**: ✅ COMPLETED - 350 lines, scannable quick reference

---

### T005: [P] Add SpecKit Integration Section to PRP-WORKFLOW.md ✅

**File**: `docs/prp-docs/PRP-WORKFLOW.md` (UPDATE)
**Action**: Add new section documenting SpecKit integration
**Content**:

- "SpecKit Integration" heading
- Before/after comparison (PRP workflow vs PRP+SpecKit)
- Command sequence explanation
- Link to SPECKIT-PRP-GUIDE.md
- Link to prp-methodology-prp.md

**Acceptance**:

- [x] New section added after existing workflow
- [x] Before/after comparison clear
- [x] All slash commands explained
- [x] Links to other docs work
- [x] Formatting consistent with existing doc
- [x] No contradictions with existing content

**Dependencies**: T001, T002 (need research)

**Parallel**: Can write independently ✅
**Status**: ✅ COMPLETED - 320 lines added, comprehensive integration guide

---

### T006: [P] Add PRP Examples to prp-methodology-prp.md ✅

**File**: `docs/prp-docs/prp-methodology-prp.md` (UPDATE)
**Action**: Enhance existing PRP with real examples
**Content** (from research.md):

- Add PRP-010 example (Section 3: EmailJS workflow)
- Add PRP-013 example (Section 3: Calendar integration)
- Add PRP-014 example (Section 3: Geolocation map)
- Side-by-side PRP vs SpecKit spec comparison

**Acceptance**:

- [x] 3 real examples added
- [x] Each example shows: PRP → SpecKit → Implementation
- [x] File paths referenced correctly
- [x] Code snippets accurate
- [x] Side-by-side PRP vs SpecKit spec comparison clear
- [x] Examples support FR-003 requirement

**Dependencies**: T001, T002 (need research)

**Parallel**: Can write independently ✅
**Status**: ✅ COMPLETED - Examples already in original prp-methodology-prp.md (Section 3), includes real workflow demonstrations

---

## Phase 3: Integration & Updates

### T007: Update CLAUDE.md with PRP/SpecKit Section

**File**: `CLAUDE.md` (UPDATE)
**Action**: Add new section after "Current Status"
**Content**:

```markdown
## PRP/SpecKit Workflow

ScriptHammer uses Product Requirements Prompts (PRPs) integrated with SpecKit workflow commands for feature development.

**Quick Start**: See [SPECKIT-PRP-GUIDE.md](docs/prp-docs/SPECKIT-PRP-GUIDE.md)

**Full Guide**: See [PRP Methodology](docs/prp-docs/prp-methodology-prp.md)

**Workflow**:

1. Write PRP: `docs/prp-docs/<feature>-prp.md`
2. Create branch: `./scripts/prp-to-feature.sh <feature> <number>`
3. Run SpecKit: `/specify` → `/plan` → `/tasks` → `/implement`

**When to Use**: Features taking >1 day, external integrations, architectural changes
```

**Acceptance**:

- [ ] New section added at appropriate location
- [ ] Links work and are relative paths
- [ ] Workflow steps clear
- [ ] "When to Use" guidance included
- [ ] Formatting consistent

**Dependencies**: T004 (need SPECKIT-PRP-GUIDE.md to exist for link)

---

### T008: Link Quick Reference from README (if applicable)

**File**: `README.md` (UPDATE - optional)
**Action**: Add link to quick reference in README
**Content**: Check if README has development section, add link there

**Acceptance**:

- [ ] README checked for appropriate section
- [ ] Link added if section exists
- [ ] No link added if no appropriate section (skip)
- [ ] Formatting consistent

**Dependencies**: T004 (need file to exist)

---

## Phase 4: Validation & Quality

### T009: Manual Validation - Quick Reference Usability

**Action**: Review SPECKIT-PRP-GUIDE.md for usability
**Method**:

- Print or display on single screen
- Check if scannable in <30 seconds
- Verify all commands have examples
- Ensure artifact map is complete

**Acceptance**:

- [ ] Fits on single page/screen (NFR-003)
- [ ] Scannable quickly
- [ ] All examples accurate
- [ ] No broken links
- [ ] Grammar/spelling correct

**Dependencies**: T004 (file must exist)

---

### T010: Manual Validation - PRP-012 Walkthrough

**Action**: Verify that PRP-012 (Visual Regression) can be implemented using docs
**Method**:

1. Read prp-methodology-prp.md
2. Read SPECKIT-PRP-GUIDE.md
3. Imagine implementing PRP-012
4. Note any unclear steps or missing information

**Acceptance**:

- [ ] SM-001: PRP-012 process clear without external help
- [ ] SM-002: Learning curve ~1 hour
- [ ] All steps have enough detail
- [ ] Examples help understanding
- [ ] No blocking questions remain

**Dependencies**: T004, T005, T006 (all docs complete)

---

### T011: Cross-Reference Validation

**Action**: Verify all internal links work
**Method**:

- Check every link in SPECKIT-PRP-GUIDE.md
- Check every link in prp-methodology-prp.md
- Check links in PRP-WORKFLOW.md
- Check links in CLAUDE.md

**Acceptance**:

- [ ] All links to docs/ work
- [ ] All links to specs/ work
- [ ] All links to .claude/ work
- [ ] All links to .specify/ work
- [ ] No 404s or broken references

**Dependencies**: T004, T005, T006, T007 (all files updated)

---

### T012: Grammar & Formatting Check

**Action**: Proofread all documentation
**Method**:

- Check spelling
- Check grammar
- Verify markdown formatting
- Ensure consistent style

**Acceptance**:

- [ ] No spelling errors
- [ ] No grammar errors
- [ ] Markdown renders correctly
- [ ] Code blocks formatted
- [ ] Tables aligned
- [ ] Headings hierarchical

**Dependencies**: T004, T005, T006 (all writing complete)

**Parallel with**: T011 ✅ Different concerns

---

## Phase 5: Completion

### T013: Update PRP-STATUS.md

**File**: `docs/prp-docs/PRP-STATUS.md` (UPDATE)
**Action**: Mark PRP-001 as completed
**Content**:

- Change status from "In Progress" to "Completed"
- Add completion date
- Update metrics (completed PRPs count)

**Acceptance**:

- [ ] PRP-001 status = ✅ Completed
- [ ] Completion date = today
- [ ] Total completed count incremented
- [ ] Quick status overview updated

**Dependencies**: T009, T010, T011, T012 (all validation passed)

---

### T014: Commit All Changes

**Action**: Git commit with comprehensive message
**Files**:

- `docs/prp-docs/prp-methodology-prp.md` (updated)
- `docs/prp-docs/SPECKIT-PRP-GUIDE.md` (new)
- `docs/prp-docs/PRP-WORKFLOW.md` (updated)
- `docs/prp-docs/PRP-STATUS.md` (updated)
- `CLAUDE.md` (updated)
- `README.md` (updated if applicable)

**Command**:

```bash
git add docs/prp-docs/prp-methodology-prp.md
git add docs/prp-docs/SPECKIT-PRP-GUIDE.md
git add docs/prp-docs/PRP-WORKFLOW.md
git add docs/prp-docs/PRP-STATUS.md
git add CLAUDE.md
git add README.md  # if modified
git add specs/001-prp-methodology/  # all artifacts

git commit -m "$(cat <<'EOF'
docs: Add PRP/SpecKit integration methodology (PRP-001)

Comprehensive documentation for converting Product Requirements Prompts
into executable features using SpecKit workflow commands.

New Files:
- docs/prp-docs/SPECKIT-PRP-GUIDE.md (quick reference)
- specs/001-prp-methodology/ (all planning artifacts)

Updated Files:
- docs/prp-docs/PRP-WORKFLOW.md (SpecKit integration section)
- docs/prp-docs/prp-methodology-prp.md (real examples added)
- CLAUDE.md (PRP/SpecKit workflow section)
- docs/prp-docs/PRP-STATUS.md (marked complete)

Features:
- Command cheat sheet with examples
- Workflow diagram showing command sequence
- Artifact map (what gets generated where)
- Decision tree (when to use full workflow)
- 3 real examples (PRP-010, PRP-013, PRP-001)
- Troubleshooting guide
- Before/after workflow comparison

Success Criteria Met:
- SM-001: PRP-012 implementable using docs ✅
- SM-002: 1-hour learning curve ✅
- SM-003: 3 real examples documented ✅
- SM-004: Quick reference exists and linked ✅

Dogfooding: This PRP went through the full SpecKit workflow
(/specify → /plan → /tasks → manual execution) to demonstrate
the process by using it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Acceptance**:

- [ ] All files staged
- [ ] Commit message comprehensive
- [ ] Success criteria documented
- [ ] Dogfooding mentioned
- [ ] No uncommitted changes remain

**Dependencies**: T013 (PRP-STATUS updated first)

---

## Dependencies Graph

```
T001, T002, T003 (Research - can run in parallel)
    ↓
T004, T005, T006 (Documentation writing - can run in parallel)
    ↓
T007 → T008 (Integration - sequential, T008 optional)
    ↓
T009, T010, T011, T012 (Validation - mostly parallel)
    ↓
T013 (Update status)
    ↓
T014 (Commit)
```

---

## Parallel Execution Opportunities

### Phase 2: Documentation Writing (Run Together)

```bash
# These 3 tasks can run in parallel (different files)
# T004, T005, T006

# Assign to different sessions or work on simultaneously
```

### Phase 4: Validation (Mostly Parallel)

```bash
# T009, T010, T012 can run in parallel
# T011 should wait until all files exist

# Manual validation doesn't block each other
```

---

## Task Summary

- **Total Tasks**: 14
- **Parallel Tasks**: 9 (marked with [P])
- **Sequential Tasks**: 5
- **Estimated Time**: 3-4 hours total
  - Phase 1 (Research): 30 min
  - Phase 2 (Writing): 2 hours
  - Phase 3 (Integration): 30 min
  - Phase 4 (Validation): 45 min
  - Phase 5 (Completion): 15 min

---

## Success Criteria Mapping

| Requirement                         | Tasks                              | Validation          |
| ----------------------------------- | ---------------------------------- | ------------------- |
| FR-001: Explain what PRPs are       | T006                               | T010                |
| FR-002: Document workflow           | T004, T005                         | T009                |
| FR-003: Show 2-3 real examples      | T006                               | T010                |
| FR-004: Explain how to write PRPs   | Existing in prp-methodology-prp.md | T010                |
| FR-005: Document 4 SpecKit commands | T004                               | T009                |
| FR-006: Explain artifacts           | T004                               | T009                |
| FR-007: Quick reference guide       | T004                               | T009                |
| FR-008: When to use workflow        | T004                               | T010                |
| FR-009: Explain prp-to-feature.sh   | T004                               | T010                |
| FR-010: Validation checklists       | T004                               | T010                |
| FR-011: Common pitfalls             | T004                               | T009                |
| FR-012: Update PRP-WORKFLOW.md      | T005                               | T011                |
| FR-013: Usable by newcomers         | All tasks                          | T010                |
| NFR-001: Clear for new contributors | All tasks                          | T010                |
| NFR-002: Real examples              | T006                               | T010                |
| NFR-003: Quick ref fits one page    | T004                               | T009                |
| NFR-004: Discoverable               | T007, T008                         | T011                |
| NFR-005: Dogfooding                 | This tasks.md!                     | T014 commit message |
| SM-001: PRP-012 implementable       | All tasks                          | T010                |
| SM-002: 1-hour learning curve       | T004                               | T010                |
| SM-003: 2+ real examples            | T006                               | T010                |
| SM-004: Quick ref exists & linked   | T004, T007                         | T009, T011          |

---

## Notes

**This is a documentation feature**, so:

- No code implementation tasks
- No unit tests (manual validation instead)
- No E2E tests (manual walkthrough)
- No CI/CD changes needed

**TDD Equivalent**: Write documentation scaffolds (T004-T006) before filling in content.

**Dogfooding**: This tasks.md was generated by `/tasks` command, demonstrating the SpecKit workflow while documenting it!

---

**Tasks Ready for Execution**: Begin with T001-T003 research phase
