# Developer Audit: Repetitive Coding Patterns

**Date**: 2026-01-15
**Author**: Auditor
**Scope**: `~/.claude/commands/*.md` (35 files) + `.claude/commands/*.md` (11 files)
**Focus**: Boilerplate generation, template expansion, code scaffolding

## Executive Summary

Reviewed 46 skill files for repetitive coding patterns that could be automated with Python scripts. Identified **6 high-priority** and **4 medium-priority** candidates. Scripts would reduce token usage, improve consistency, and enable component reuse across projects.

## Already Established Patterns (Reference)

| Pattern | Implementation | Scope |
|---------|---------------|-------|
| Ignore file patterns | Embedded in `speckit.implement.md` | Per-project |
| 5-file component | Constitution principle | Required |
| Checklist format | `CHK###` pattern in `speckit.checklist.md` | Per-feature |

---

## High Priority Candidates

### 1. 5-File Component Generator → `generate-component.py`

**Current**: Constitution mandates 5-file pattern but no generator exists. LLM creates each file manually.

**Pattern** (from constitution):
```
ComponentName/
├── index.tsx           # Re-exports
├── ComponentName.tsx   # Implementation
├── ComponentName.test.tsx          # Unit tests
├── ComponentName.stories.tsx       # Storybook
└── ComponentName.accessibility.test.tsx  # Pa11y
```

**Script Opportunity**:
```bash
python generate-component.py Button --path src/components/atoms
python generate-component.py UserCard --path src/components/molecules --with-props "name:string,avatar:string"
python generate-component.py --dry-run LoginForm
```

**Why Script**:
- Constitution-mandated pattern = 100% predictable structure
- LLM spends tokens recreating same boilerplate every time
- Consistency across components guaranteed
- Enables pre-commit hook validation

**Template Content**:
```typescript
// index.tsx template
export { default } from './[COMPONENT_NAME]'
export type { [COMPONENT_NAME]Props } from './[COMPONENT_NAME]'

// Component.tsx template
import type { FC } from 'react'

export interface [COMPONENT_NAME]Props {
  // Props here
}

export const [COMPONENT_NAME]: FC<[COMPONENT_NAME]Props> = (props) => {
  return <div data-testid="[component-name]">...</div>
}

export default [COMPONENT_NAME]
```

**Estimated Effort**: 3-4 hours

---

### 2. Ignore File Generator → `generate-ignores.py`

**Current**: `speckit.implement.md` lines 58-99 contain ~40 lines of language/tool patterns embedded in prompt.

**Current Pattern** (from `speckit.implement.md`):
```text
**Node.js**: node_modules/, dist/, build/, *.log, .env*
**Python**: __pycache__/, *.pyc, .venv/, venv/, dist/
**Java**: target/, *.class, *.jar, .gradle/, build/
... (15+ language patterns)
```

**Script Opportunity**:
```bash
python generate-ignores.py --detect           # Auto-detect tech stack
python generate-ignores.py --stack node,docker
python generate-ignores.py --gitignore --dockerignore --eslintignore
python generate-ignores.py --verify           # Check existing files
```

**Why Script**:
- Tech stack detection is deterministic (file pattern matching)
- Same patterns repeated across every project setup
- Claude's own `/implement` skill embeds these as static text
- Reduces ~40 prompt lines to single function call

**Estimated Effort**: 2-3 hours

---

### 3. Task ID Validator → `validate-tasks.py`

**Current**: `speckit.tasks.md` enforces strict task format but validation is manual.

**Required Format**:
```text
- [ ] T001 [P] [US1] Description with file path
      │     │    │
      │     │    └── Story label (required for story phases)
      │     └── Parallel marker (optional)
      └── Sequential ID (required)
```

**Script Opportunity**:
```bash
python validate-tasks.py tasks.md             # Validate format
python validate-tasks.py tasks.md --fix       # Auto-fix IDs
python validate-tasks.py tasks.md --renumber  # Renumber all tasks
python validate-tasks.py --check-deps         # Verify dependencies
```

**Why Script**:
- Format validation is regex-based (deterministic)
- ID renumbering after edits is tedious
- Dependency checking is graph traversal
- Currently LLM parses and validates manually

**Validation Rules**:
- Checkbox present: `- [ ]` or `- [x]`
- ID format: `T###` sequential
- Story label: `[US#]` for story phases only
- File path: Required for implementation tasks

**Estimated Effort**: 2-3 hours

---

### 4. Checklist Scaffolder → `scaffold-checklist.py`

**Current**: `speckit.checklist.md` (294 lines) generates checklists with extensive category templates.

**Standard Categories** (from prompt):
- Requirement Completeness
- Requirement Clarity
- Requirement Consistency
- Acceptance Criteria Quality
- Scenario Coverage
- Edge Case Coverage
- Non-Functional Requirements
- Dependencies & Assumptions

**Script Opportunity**:
```bash
python scaffold-checklist.py --type ux         # UX-focused checklist
python scaffold-checklist.py --type api        # API checklist
python scaffold-checklist.py --type security   # Security checklist
python scaffold-checklist.py --from spec.md    # Extract from spec
python scaffold-checklist.py --template custom.json
```

**Why Script**:
- Category structure is predetermined
- Item format is fixed: `- [ ] CHK### - Question [Quality, Spec §X]`
- LLM spends tokens generating same structure repeatedly
- Custom templates could be JSON-defined

**Estimated Effort**: 3-4 hours

---

### 5. Spec Section Extractor → `extract-spec.py`

**Current**: Multiple skills (`speckit.plan`, `speckit.tasks`, `speckit.implement`) all parse spec.md for the same sections.

**Common Extractions**:
- User stories with priorities (P0, P1, P2)
- Functional requirements (FR-###)
- Non-functional requirements (NFR-###)
- Key entities
- Edge cases
- Acceptance criteria

**Script Opportunity**:
```bash
python extract-spec.py spec.md --user-stories  # Extract user stories
python extract-spec.py spec.md --requirements  # FR/NFR list
python extract-spec.py spec.md --entities      # Key entities
python extract-spec.py spec.md --json          # Full structured output
python extract-spec.py spec.md --summary       # One-line counts
```

**Why Script**:
- Section parsing uses consistent markdown patterns
- Same extraction logic duplicated across 4+ skills
- JSON output enables downstream script chaining
- Reduces token usage for every SpecKit command

**Estimated Effort**: 3-4 hours

---

### 6. Test File Scaffolder → `scaffold-test.py`

**Current**: Tests created manually following TDD approach. Same boilerplate for every test file.

**Common Test Patterns**:
```typescript
// Unit test boilerplate
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ComponentName } from './ComponentName'

describe('ComponentName', () => {
  beforeEach(() => { ... })

  it('should render correctly', () => { ... })
  it('should handle user interaction', () => { ... })
})
```

**Script Opportunity**:
```bash
python scaffold-test.py Button --type unit
python scaffold-test.py UserService --type integration
python scaffold-test.py LoginForm --type e2e --framework playwright
python scaffold-test.py --from data-model.md  # Generate entity tests
```

**Why Script**:
- Test structure is predictable per type
- Import statements follow project conventions
- Mock setup follows consistent patterns
- Reduces "red" phase boilerplate in TDD

**Estimated Effort**: 4-5 hours

---

## Medium Priority Candidates

### 7. Commit Message Builder → `build-commit.py`

**Current**: `commit.md` skill enforces conventional commits with standard footer.

**Standard Footer**:
```text
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Script Opportunity**:
```bash
python build-commit.py --type feat --scope auth --message "Add OAuth support"
python build-commit.py --from-staged          # Analyze staged files
python build-commit.py --interactive          # Prompt for details
```

**Partial Script Candidate**: Message content needs LLM, but format/footer is deterministic.

**Estimated Effort**: 1-2 hours

---

### 8. Plan Template Filler → `fill-plan.py`

**Current**: `speckit.plan.md` fills template with tech context, constitution check, project structure.

**Template Sections**:
- Technical Context (language, deps, storage, testing)
- Constitution Check (6 principles)
- Project Structure (tree diagrams)
- Complexity Tracking

**Script Opportunity**:
```bash
python fill-plan.py --tech-context package.json  # Extract from package
python fill-plan.py --constitution-check         # Generate compliance table
python fill-plan.py --structure-detect           # Generate tree from codebase
```

**Why Partial**: Tech detection deterministic; architecture decisions need LLM.

**Estimated Effort**: 2-3 hours

---

### 9. Data Model Parser → `parse-data-model.py`

**Current**: `data-model.md` files manually created; entities extracted by LLM in multiple skills.

**Script Opportunity**:
```bash
python parse-data-model.py data-model.md --entities    # List entities
python parse-data-model.py data-model.md --relations   # Relationships
python parse-data-model.py data-model.md --typescript  # Generate types
python parse-data-model.py data-model.md --sql         # Generate DDL
```

**Why Script**:
- Entity extraction is pattern matching
- Type generation is templated
- Same parsing in `speckit.tasks`, `speckit.implement`

**Estimated Effort**: 3-4 hours

---

### 10. Contract Validator → `validate-contracts.py`

**Current**: `contracts/` folder contains OpenAPI specs, manually validated.

**Script Opportunity**:
```bash
python validate-contracts.py contracts/auth-api.yaml  # Validate spec
python validate-contracts.py --coverage spec.md       # Check FR coverage
python validate-contracts.py --generate-tests         # Stub test files
```

**Why Script**:
- OpenAPI validation is well-defined
- Coverage checking is matching exercise
- Test stub generation is templated

**Estimated Effort**: 3-4 hours

---

## Not Recommended for Scripting

| Skill | Reason |
|-------|--------|
| `speckit.specify` | Creative spec writing from natural language |
| `speckit.clarify` | Interactive requirement refinement |
| `speckit.analyze` | Semantic consistency analysis |
| `code-review` | Security/quality assessment needs reasoning |
| `wireframe.md` | SVG generation is creative |

---

## Implementation Priority

| Priority | Script | Impact | Effort | Dependencies |
|----------|--------|--------|--------|--------------|
| 1 | `generate-component.py` | High (Constitution compliance) | 3-4h | None |
| 2 | `generate-ignores.py` | High (Every project setup) | 2-3h | None |
| 3 | `extract-spec.py` | High (Used by 4+ skills) | 3-4h | None |
| 4 | `validate-tasks.py` | Medium (Task management) | 2-3h | None |
| 5 | `scaffold-checklist.py` | Medium (Checklist creation) | 3-4h | None |
| 6 | `scaffold-test.py` | Medium (TDD workflow) | 4-5h | `generate-component.py` |
| 7 | `parse-data-model.py` | Low (Occasional use) | 3-4h | None |
| 8 | `fill-plan.py` | Low (Partial automation) | 2-3h | `extract-spec.py` |
| 9 | `build-commit.py` | Low (Simple pattern) | 1-2h | None |
| 10 | `validate-contracts.py` | Low (OpenAPI-specific) | 3-4h | None |

**Total Estimated Effort**: 28-36 hours

---

## Pattern Analysis Summary

| Category | Skill Files | Lines of Patterns | Script Opportunity |
|----------|-------------|-------------------|-------------------|
| Boilerplate Generation | 3 | ~150 lines | `generate-*` scripts |
| Template Expansion | 4 | ~200 lines | `fill-*`, `scaffold-*` scripts |
| Code Scaffolding | 2 | ~100 lines | `generate-component.py` |
| Validation/Parsing | 3 | ~120 lines | `validate-*`, `extract-*` scripts |

---

## Recommended Next Steps

1. **Immediate**: Create `generate-component.py` - Constitution compliance
2. **This Sprint**: Add `generate-ignores.py` - Removes 40 lines from `speckit.implement.md`
3. **Next Sprint**: `extract-spec.py` - Shared utility for all SpecKit commands
4. **Ongoing**: Remaining scripts as capacity allows

---

## Integration with Existing Scripts

New scripts should follow patterns established in:
- `validate-wireframe.py` - JSON/summary output modes
- `inspect-wireframes.py` - `--all`, `--report` flags
- `screenshot-wireframes.py` - Per-file processing

**Standard Interface Pattern**:
```python
#!/usr/bin/env python3
"""
[Tool Name] - [One-line description]

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

6 high-priority scripts would eliminate ~450 lines of repetitive patterns from skill prompts and ensure consistency across the 5-file component pattern (constitution requirement). The `generate-component.py` script is highest priority as it enforces a constitutional mandate.

Recommend prioritizing `generate-component.py` and `generate-ignores.py` for immediate implementation.

---

## Addendum: Developer Session - 000-RLS Implementation Status

**Date**: 2026-01-15 (continued)
**Role**: Developer

### Next Implementation Step for 000-rls-implementation

**Status**: 48/60 tasks complete. 12 tasks require manual Supabase project setup.

| Task ID | Description | Blocker |
|---------|-------------|---------|
| T014 | Apply migration via Supabase Dashboard SQL Editor | Requires Supabase project |
| T021 | Apply updated migration (US1 policies) | Requires Supabase project |
| T022 | Verify tests pass for user isolation | Requires running tests |
| T028 | Apply updated migration (US2 policies) | Requires Supabase project |
| T029 | Verify tests pass for profile self-management | Requires running tests |
| T037 | Verify tests pass for service role operations | Requires running tests |
| T044 | Verify tests pass for anonymous restrictions | Requires running tests |
| T053 | Apply updated migration (US5 policies) | Requires Supabase project |
| T054 | Verify tests pass for audit immutability | Requires running tests |
| T057 | Run full RLS test suite | Requires Supabase project |
| T059 | Performance test: verify <10ms policy latency | Requires Supabase project |
| T060 | Security review checklist completion | Requires security review |

**Recommended Next Step**: Create Supabase project via dashboard, then:
```bash
# 1. Copy migration to Dashboard SQL Editor
cat supabase/migrations/00000000000000_rls_foundation.sql

# 2. Configure .env.local with Supabase credentials
# (copy from .env.example, fill in values)

# 3. Run test suite
npm run test -- tests/rls/
```

### Additional Pattern Candidate: RLS Policy Validation

From `speckit.tasks.md` and `supabase/migrations/`:

**Currently Interpreted Dynamically**:
- Policy naming convention: `{table}_{operation}_{scope}` (e.g., `profiles_select_own`)
- RLS USING clause patterns: `auth.uid() = id` for ownership
- Policy coverage verification per user story

**Should Be Codified As**: `validate-rls-policies.py`
```python
POLICY_PATTERN = r'^(?P<table>\w+)_(?P<op>select|insert|update|delete)_(?P<scope>own|all|none)$'
OWNERSHIP_PATTERNS = {
    'profiles': 'id = auth.uid()',
    'audit_logs': 'user_id = auth.uid()',
}

def validate_policy_naming(policy_name):
    match = re.match(POLICY_PATTERN, policy_name)
    if not match:
        return f"Invalid naming: {policy_name}"
```

**TASK COMPLETE**
