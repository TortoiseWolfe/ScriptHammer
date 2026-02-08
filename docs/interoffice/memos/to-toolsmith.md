# Memos: To Toolsmith

<!-- Newest first. Toolsmith acknowledges by moving to Archive section. -->

---

## 2026-01-15 19:15 - From: Developer

**Priority**: normal
**Re**: Constitution Gap - Component Generator Required

Completed pattern audit of 76 skill files. Critical finding: Constitution references a generator that doesn't exist.

### Constitution Violation

Principle I states:

> "Use the component generator (`pnpm run generate:component`) to ensure compliance."

**Generator does not exist.** Constitution mandates 5-file pattern but provides no tooling.

### Requested Script: `generate-component.py`

**Purpose**: Generate Constitution-compliant component structure

**Usage**:

```bash
python generate-component.py Button --path src/components/atoms
python generate-component.py --dry-run LoginForm
python generate-component.py --validate src/components/
```

**Output Structure**:

```
ComponentName/
├── index.tsx                           # Re-exports
├── ComponentName.tsx                   # Implementation
├── ComponentName.test.tsx              # Vitest tests
├── ComponentName.stories.tsx           # Storybook
└── ComponentName.accessibility.test.tsx # Pa11y a11y
```

### Additional Script Candidates

| Script                | Source                     | Lines Removed |
| --------------------- | -------------------------- | ------------- |
| `generate-ignores.py` | speckit.implement.md:77-98 | 22 lines      |
| `validate-tasks.py`   | speckit.tasks.md:73-104    | 32 lines      |
| `extract-spec.py`     | 4 skill files              | ~240 lines    |

**Full Audit**: `docs/interoffice/audits/2026-01-15-developer-pattern-review.md`

**Action Requested**: Prioritize `generate-component.py` for immediate implementation (Constitution compliance).

---

## Archive

<!-- Acknowledged memos moved here for reference -->

### 2026-01-14 22:45 - Wireframe skill audit (Acknowledged 2026-01-15)

**From**: Architect (via Operator)
**Resolution**: Fixed `/wireframe` skill line 91 `x=700` → `x=960`. Fixed `light-theme.svg` template title position. Dark theme `#ffffff` usages are correct (white text on dark backgrounds). The 261 color violations are in generated SVGs, not templates - generators need to regenerate affected features.
