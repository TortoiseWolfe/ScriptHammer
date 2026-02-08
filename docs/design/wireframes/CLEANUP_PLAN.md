# Wireframe Workflow Cleanup Plan

**Created**: 2026-01-11
**Updated**: 2026-01-11 (after detailed research)
**Purpose**: Document plan so work can resume if Claude crashes

## Problem Summary

| Issue                    | Current State                                         | Impact                                                                      |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| wireframe.md version     | v3.0 (405 lines)                                      | Missing User Stories, doesn't match CLAUDE.md v3.1                          |
| wireframe-review.md size | 1,332 lines                                           | Crashes from verbosity, conflicting "minimal output" vs "detailed matrices" |
| 002:01 stuck             | Pass 12, still 🔴                                     | v3.0 command can't produce v3.1 output                                      |
| Multi-phase output       | PRE-FLIGHT → LAYOUT → GENERATE → VERIFY → VIEWER SYNC | 5 user confirmations per SVG                                                |

## Root Cause Analysis

**wireframe-review.md contradicts itself:**

- Lines 20-26: "NO verbose status confirmations"
- Line 1160: "Still complete Visual Description + Overlap Matrix + Devil's Advocate"
- These are incompatible - can't do detailed work AND be minimal

**wireframe.md is outdated:**

- Line 15: "Exclude User Stories section"
- CLAUDE.md says v3.1 REQUIRES User Stories (compact format at y=850)

## Cleanup Tasks

### Phase 1: Simplify wireframe-review.md (PRIORITY)

**Goal**: Reduce from 1,332 lines to ~300 lines

**Keep**:

- Binary classification (🟢 PATCHABLE / 🔴 REGENERATE)
- Automatic 🔴 triggers list
- Issue categories A-D (but condensed)
- wireframe-status.json update

**Remove/Move to reference doc**:

- Verbose viewer setup instructions (34 lines → "Open viewer at 1920×1080")
- 13 blocking checks expanded text (keep checklist, remove explanations)
- Devil's Advocate / Overlap Matrix / Visual Description requirements
- Nested sub-checks within categories

**Output rules**:

- Report issues only
- No "checking X... ✓" confirmations
- Summary table at end

### Phase 2: Update wireframe.md to v3.1

**Changes needed**:

- Add User Stories compact card spec (at y=850)
- Add badge placement rules (10px OUTSIDE elements, not ON TOP)
- Simplify PRE-FLIGHT + LAYOUT PLAN to single approval
- Reference GENERAL_ISSUES.md instead of duplicating rules

### Phase 3: Reset 002:01

**Instead of Pass 13**, regenerate fresh with v3.1:

1. Read spec.md for 002-cookie-consent
2. Run simplified /wireframe 002:01
3. Single review pass with simplified /wireframe-review

### Phase 4: Batch remaining features

Once 002 validates the simplified workflow:

- Process 000, 001 with same pattern
- Then 003-045

## File Locations

| File                | Path                                                                        | Action               |
| ------------------- | --------------------------------------------------------------------------- | -------------------- |
| wireframe.md        | `~/.claude/commands/wireframe.md`                                           | Update to v3.1       |
| wireframe-review.md | `~/.claude/commands/wireframe-review.md`                                    | Simplify             |
| GENERAL_ISSUES.md   | `docs/design/wireframes/GENERAL_ISSUES.md`                                  | Keep as reference    |
| 002:01 issues       | `docs/design/wireframes/002-cookie-consent/01-consent-modal-flow.issues.md` | Archive, start fresh |

## If Claude Crashes

1. Read this file
2. Check git status for uncommitted work
3. Resume at current phase
4. Key context: wireframe commands are in `~/.claude/commands/`, not repo

## Success Criteria

- [ ] wireframe-review.md < 400 lines
- [ ] wireframe.md matches CLAUDE.md v3.1 spec
- [ ] 002:01 passes review in ≤ 2 passes
- [ ] No multi-phase approval friction
