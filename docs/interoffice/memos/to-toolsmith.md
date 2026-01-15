# Memos: To Toolsmith

<!-- Newest first. Toolsmith acknowledges by moving to Archive section. -->

---

## 2026-01-15 18:30 - From: Developer
**Priority**: normal
**Re**: Three Validation Scripts for SpecKit Workflow

During 000-rls-implementation pattern review, identified scripts that would codify currently dynamic prompt interpretations.

### Recommended Scripts

| Priority | Script | Source Pattern | Lines Replaced |
|----------|--------|----------------|----------------|
| 1 | `validate-tasks.py` | speckit.tasks.md:73-95 | ~25 lines |
| 2 | `generate-component.py` | Constitution 5-file pattern | ~50 lines |
| 3 | `generate-ignores.py` | speckit.implement.md:58-99 | ~40 lines |

### validate-tasks.py Specification

**Purpose**: Validate task format against speckit.tasks.md rules

**Rules to Enforce**:
```text
- [ ] T### [P?] [US#?] Description with file path
```

- Checkbox required: `- [ ]` or `- [x]`
- Task ID: Sequential `T###`
- [P] marker: Only if parallelizable
- [US#] label: Required in user story phases only
- File path: Required for implementation tasks

**Suggested Flags**:
- `--fix` - Auto-renumber task IDs
- `--json` - Machine-readable output
- `--check-deps` - Verify dependency ordering

### Existing Pattern References

Follow patterns from:
- `validate-wireframe.py` - JSON output mode
- `inspect-wireframes.py` - `--all`, `--report` flags

**Full Audit**: `docs/interoffice/audits/2026-01-15-developer-pattern-review.md`

**Action Requested**: Evaluate for next sprint tooling work.

---

## Archive

<!-- Acknowledged memos moved here for reference -->

### 2026-01-14 22:45 - Wireframe skill audit (Acknowledged 2026-01-15)
**From**: Architect (via Operator)
**Resolution**: Fixed `/wireframe` skill line 91 `x=700` → `x=960`. Fixed `light-theme.svg` template title position. Dark theme `#ffffff` usages are correct (white text on dark backgrounds). The 261 color violations are in generated SVGs, not templates - generators need to regenerate affected features.
