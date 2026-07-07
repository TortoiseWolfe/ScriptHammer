# Developer Audit: Boilerplate & Scaffolding Patterns

**Date**: 2026-01-15
**Author**: Developer Terminal
**Scope**: `~/.claude/commands/*.md` (65 files) + `.claude/commands/*.md` (11 files)
**Focus**: Boilerplate generation, template expansion, code scaffolding, component generation

## Executive Summary

Reviewed 76 skill files from the Developer perspective, focusing on code generation patterns that consume tokens during implementation work. Identified **6 high-priority** and **4 medium-priority** candidates for automation. Primary finding: the Constitution-mandated 5-file component pattern has no generator, causing repetitive boilerplate creation.

## Reference: Already Scripted Patterns

| Pattern               | Script                     | Location                  |
| --------------------- | -------------------------- | ------------------------- |
| SVG validation        | `validate-wireframe.py`    | `docs/design/wireframes/` |
| Cross-SVG consistency | `inspect-wireframes.py`    | `docs/design/wireframes/` |
| SVG screenshots       | `screenshot-wireframes.py` | `docs/design/wireframes/` |

These demonstrate the target pattern: **prompt defines workflow, script does deterministic work**.

---

## High Priority Candidates

### 1. Component Generator → `generate-component.py`

**Source**: Constitution (lines 7-13) mandates 5-file pattern with no generator.

**Constitution Requirement**:

> "Every component MUST follow the 5-file pattern: index.tsx, Component.tsx, Component.test.tsx, Component.stories.tsx, and Component.accessibility.test.tsx."

**Current State**: LLM manually creates 5 files per component, repeating same boilerplate.

**Script Opportunity**:

```bash
python generate-component.py Button --path src/components/atoms
python generate-component.py UserCard --path src/components/molecules
python generate-component.py --dry-run LoginForm
python generate-component.py --validate src/components/  # Check existing
```

**Template Files**:

```
ComponentName/
├── index.tsx                           # Re-exports
├── ComponentName.tsx                   # Implementation
├── ComponentName.test.tsx              # Vitest unit tests
├── ComponentName.stories.tsx           # Storybook
└── ComponentName.accessibility.test.tsx # Pa11y a11y tests
```

**Why Script**:

- Constitution-mandated = 100% predictable structure
- Each component consumes ~500 tokens in boilerplate
- Enables CI validation of component structure
- `pnpm run generate:component` referenced in constitution but doesn't exist

**Estimated Effort**: 3-4 hours

---

### 2. Ignore File Generator → `generate-ignores.py`

**Source**: `speckit.implement.md` (lines 77-98) embeds 22 lines of language patterns.

**Current Embedded Patterns**:

```text
Node.js: node_modules/, dist/, build/, *.log, .env*
Python: __pycache__/, *.pyc, .venv/, venv/, dist/
Java: target/, *.class, *.jar, .gradle/, build/
Go: *.exe, *.test, vendor/, *.out
Rust: target/, debug/, release/, *.rs.bk
... (12+ more languages)
```

**Script Opportunity**:

```bash
python generate-ignores.py --detect           # Auto-detect from files
python generate-ignores.py --stack node,docker
python generate-ignores.py --gitignore --dockerignore --eslintignore
python generate-ignores.py --verify           # Validate existing files
```

**Why Script**:

- Tech detection is file-pattern matching (deterministic)
- Same 22 lines repeated in every project setup
- Reduces prompt size significantly
- Enables consistent ignore patterns across projects

**Estimated Effort**: 2-3 hours

---

### 3. Task Format Validator → `validate-tasks.py`

**Source**: `speckit.tasks.md` (lines 73-104) defines strict format rules.

**Required Format**:

```text
- [ ] T001 [P] [US1] Description with file path
```

**Format Rules** (from speckit.tasks.md):

1. Checkbox: ALWAYS start with `- [ ]`
2. Task ID: Sequential `T###`
3. [P] marker: Only if parallelizable
4. [Story] label: Required in user story phases
5. Description: Must include file path

**Script Opportunity**:

```bash
python validate-tasks.py tasks.md             # Validate format
python validate-tasks.py tasks.md --fix       # Auto-renumber IDs
python validate-tasks.py tasks.md --coverage  # Check story coverage
python validate-tasks.py --check-deps         # Verify dependencies
```

**Why Script**:

- Validation is regex-based (deterministic)
- Currently LLM validates manually each time
- Renumbering after edits is tedious
- Could integrate with CI

**Estimated Effort**: 2-3 hours

---

### 4. Spec Section Extractor → `extract-spec.py`

**Source**: Multiple skills parse spec.md for same sections.

**Files Parsing spec.md**:

- `speckit.plan.md` - Extracts user stories, requirements
- `speckit.tasks.md` - Extracts user stories with priorities
- `speckit.implement.md` - Reads for context
- `speckit.analyze.md` - Parses for consistency check

**Common Extractions**:

- User stories with priorities (P0, P1, P2)
- Functional requirements (FR-###)
- Non-functional requirements (NFR-###)
- Acceptance criteria
- Edge cases

**Script Opportunity**:

```bash
python extract-spec.py spec.md --user-stories  # JSON list
python extract-spec.py spec.md --requirements  # FR/NFR list
python extract-spec.py spec.md --json          # Full structured output
python extract-spec.py spec.md --summary       # One-line counts
```

**Why Script**:

- Markdown parsing is deterministic
- Same extraction duplicated in 4+ skills
- JSON output enables script chaining
- Reduces token usage across all SpecKit commands

**Estimated Effort**: 3-4 hours

---

### 5. Checklist Scaffolder → `scaffold-checklist.py`

**Source**: `speckit.checklist.md` (lines 106-116) defines standard categories.

**Standard Categories**:

```text
- Requirement Completeness
- Requirement Clarity
- Requirement Consistency
- Acceptance Criteria Quality
- Scenario Coverage
- Edge Case Coverage
- Non-Functional Requirements
- Dependencies & Assumptions
```

**Item Format**: `- [ ] CHK### - Question [Quality, Spec §X]`

**Script Opportunity**:

```bash
python scaffold-checklist.py --type ux         # UX checklist
python scaffold-checklist.py --type api        # API checklist
python scaffold-checklist.py --type security   # Security checklist
python scaffold-checklist.py --from spec.md    # Extract from spec
```

**Why Script**:

- Category structure is predetermined
- Item numbering is sequential
- Reduces token usage for standard structure
- Templates could be JSON-defined

**Estimated Effort**: 3-4 hours

---

### 6. Test File Scaffolder → `scaffold-test.py`

**Source**: Constitution (lines 15-20) mandates TDD approach.

**Constitution Requirement**:

> "Tests MUST be written before implementation following RED-GREEN-REFACTOR cycle."

**Common Test Patterns**:

```typescript
// Vitest unit test boilerplate
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  beforeEach(() => {
    /* setup */
  });
  it('should render correctly', () => {
    /* test */
  });
});
```

**Script Opportunity**:

```bash
python scaffold-test.py Button --type unit
python scaffold-test.py UserService --type integration
python scaffold-test.py LoginForm --type e2e --framework playwright
python scaffold-test.py --from data-model.md  # Entity tests
```

**Why Script**:

- Test structure is predictable per type
- Import statements follow project conventions
- Reduces "red" phase boilerplate
- Integrates with `generate-component.py`

**Estimated Effort**: 4-5 hours

---

## Medium Priority Candidates

### 7. Data Model Parser → `parse-data-model.py`

**Source**: `data-model.md` parsed by multiple skills.

**Script Opportunity**:

```bash
python parse-data-model.py data-model.md --entities    # List entities
python parse-data-model.py data-model.md --typescript  # Generate types
python parse-data-model.py data-model.md --sql         # Generate DDL
```

**Why Script**:

- Entity extraction is pattern matching
- Type generation is templated
- Used by `speckit.tasks`, `speckit.implement`

**Estimated Effort**: 3-4 hours

---

### 8. Plan Template Filler → `fill-plan.py`

**Source**: `speckit.plan.md` fills template sections.

**Deterministic Sections**:

- Technical Context (from package.json)
- Constitution Check (6 principles table)
- Project Structure (tree from codebase)

**Script Opportunity**:

```bash
python fill-plan.py --tech-context package.json
python fill-plan.py --constitution-check
python fill-plan.py --structure-detect
```

**Partial Automation**: Architecture decisions still need LLM.

**Estimated Effort**: 2-3 hours

---

### 9. Commit Message Builder → `build-commit.py`

**Source**: `commit.md` enforces conventional commits format.

**Standard Footer**:

```text
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Script Opportunity**:

```bash
python build-commit.py --type feat --scope auth --message "Add OAuth"
python build-commit.py --from-staged  # Analyze staged files for type
```

**Partial Automation**: Message content needs LLM, format is deterministic.

**Estimated Effort**: 1-2 hours

---

### 10. Contract Validator → `validate-contracts.py`

**Source**: `contracts/` folder contains API specs.

**Script Opportunity**:

```bash
python validate-contracts.py contracts/*.yaml  # Validate OpenAPI
python validate-contracts.py --coverage spec.md  # Check FR coverage
python validate-contracts.py --generate-stubs    # Stub test files
```

**Estimated Effort**: 3-4 hours

---

## Not Recommended for Scripting

| Skill               | Reason                                      |
| ------------------- | ------------------------------------------- |
| `speckit.specify`   | Creative spec writing from natural language |
| `speckit.clarify`   | Interactive requirement refinement          |
| `speckit.analyze`   | Semantic consistency analysis               |
| `code-review`       | Security assessment needs reasoning         |
| `wireframe.md`      | SVG generation is creative                  |
| `/council`, `/memo` | Interactive communication                   |

---

## Implementation Priority

| Priority | Script                  | Impact | Effort | Constitution                |
| -------- | ----------------------- | ------ | ------ | --------------------------- |
| 1        | `generate-component.py` | High   | 3-4h   | **Required** (Principle I)  |
| 2        | `generate-ignores.py`   | High   | 2-3h   | Supports Principle IV       |
| 3        | `extract-spec.py`       | High   | 3-4h   | Supports Principle III      |
| 4        | `validate-tasks.py`     | Medium | 2-3h   | Supports Principle III      |
| 5        | `scaffold-test.py`      | Medium | 4-5h   | **Required** (Principle II) |
| 6        | `scaffold-checklist.py` | Medium | 3-4h   | Supports Principle III      |
| 7        | `parse-data-model.py`   | Low    | 3-4h   | -                           |
| 8        | `fill-plan.py`          | Low    | 2-3h   | -                           |
| 9        | `build-commit.py`       | Low    | 1-2h   | -                           |
| 10       | `validate-contracts.py` | Low    | 3-4h   | -                           |

**Total Estimated Effort**: 28-36 hours

---

## Pattern Analysis

| Category             | Source Files         | Lines Embedded | Script Target           |
| -------------------- | -------------------- | -------------- | ----------------------- |
| Component Structure  | constitution.md      | 7 lines        | `generate-component.py` |
| Ignore Patterns      | speckit.implement.md | 22 lines       | `generate-ignores.py`   |
| Task Format          | speckit.tasks.md     | 32 lines       | `validate-tasks.py`     |
| Checklist Categories | speckit.checklist.md | 10 lines       | `scaffold-checklist.py` |
| Spec Parsing         | 4 skill files        | ~60 lines each | `extract-spec.py`       |
| Test Boilerplate     | constitution.md      | 6 lines        | `scaffold-test.py`      |

**Total Embedded Patterns**: ~570 lines across 10 files

---

## Recommended Next Steps

1. **Immediate**: Create `generate-component.py`
   - Constitution mandates it but doesn't exist
   - Highest impact on daily development
   - Enables CI validation

2. **This Sprint**: Add `generate-ignores.py`
   - Removes 22 lines from `speckit.implement.md`
   - Every project setup benefits

3. **Next Sprint**: `extract-spec.py` + `validate-tasks.py`
   - Shared utilities reduce token usage
   - Enable downstream script chaining

---

## Script Interface Standard

Follow patterns from existing scripts:

```python
#!/usr/bin/env python3
"""
[Tool Name] - [Description]

Usage:
    python tool.py [args]         # Standard output
    python tool.py --json         # Machine-readable
    python tool.py --dry-run      # Preview without changes
"""

import argparse
import json
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='...')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    result = process(args)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        display_human_readable(result)

if __name__ == '__main__':
    main()
```

---

## Conclusion

From a Developer perspective, the highest-impact script is `generate-component.py` because:

1. Constitution mandates the 5-file pattern
2. No generator currently exists (despite being referenced)
3. Every component creation consumes ~500 tokens in boilerplate
4. CI validation depends on consistent structure

Second priority is `generate-ignores.py` to remove 22 lines of embedded patterns from `speckit.implement.md`.

**Recommendation**: Escalate `generate-component.py` to Toolsmith for immediate implementation.
