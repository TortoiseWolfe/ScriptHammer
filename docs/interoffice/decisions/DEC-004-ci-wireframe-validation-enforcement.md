# DEC-004: CI Wireframe Validation Enforcement Timeline

**Date**: 2026-01-15
**RFC**: RFC-004
**Status**: active

## Stakeholder Votes

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-15 |
| Architect     | approve | 2026-01-15 |
| Security Lead | approve | 2026-01-15 |
| Toolsmith     | approve | 2026-01-15 |
| DevOps        | approve | 2026-01-15 |
| Product Owner | approve | 2026-01-15 |

## Decision

Formalize the enforcement timeline for CI wireframe validation in `.github/workflows/ci.yml` using a **3-phase enforcement model**. Validation transitions from soft-fail to hard-fail based on measurable criteria, not calendar dates.

---

## 3-Phase Enforcement Model

### Phase 1: Planning (Current)

**Configuration**: `continue-on-error: true`

**Behavior**:

- Validation runs on every PR and push to main
- Failures logged but do not block merge
- Results visible in GitHub Actions logs only

**Purpose**: Allow rapid wireframe iteration during spec-first planning without friction. Generators can focus on design exploration without CI blocking their work.

**Validation Scope**: The `validate-wireframe.py` script (v5.2+) runs 30+ automated checks:

- SVG structure and XML validity
- Color compliance (`#e8d4b8` panel backgrounds, no white)
- Typography standards (Inter font, size hierarchy)
- Layout rules (canvas 1920x1080, desktop/mobile positioning)
- Accessibility (44px touch targets, contrast, annotations)

---

### Phase 2: Transition

**Configuration**: `continue-on-error: true` (unchanged)

**Behavior**:

- Validation runs on every PR
- Failures still do not block merge
- **NEW**: Issue counts posted as PR comment via GitHub Actions

**Purpose**: Increase visibility without blocking. Surface validation results directly on PRs to drive accountability. Give Generators time to resolve issues before enforcement begins.

**PR Comment Format**:

```
## Wireframe Validation Results
- **Pass**: XX SVGs
- **Fail**: XX SVGs
- **Issues**: XX

_Enforcement pending. See DEC-004 for criteria._
```

---

### Phase 3: Enforcement

**Configuration**: Remove `continue-on-error: true`

**Behavior**:

- Validation runs on every PR
- **Failures block merge** until resolved
- PR cannot be merged with validation errors

**Purpose**: Protect quality baseline. Prevent regression as implementation begins. Ensure wireframes remain spec-compliant throughout the development lifecycle.

**Exception Process** (when validation errors cannot be immediately fixed):

1. Create `[feature].exception.md` documenting the reason
2. Add `<!-- validation-exception: REASON -->` comment to SVG
3. Validator ignores files with documented exceptions
4. Exceptions reviewed quarterly by Architect + Product Owner

---

## Rationale

1. **No formal review** - The original decision was bundled with org audit commit, not explicitly approved
2. **Undefined triggers** - No criteria specified for when to move between phases
3. **Cross-terminal impact** - Affects Validator, Generators, Reviewers, Inspector without their input
4. **Quality risk** - Soft-fail means validation issues may accumulate unnoticed

The three-phase model (Planning → Transition → Enforcement) with criteria-based progression ensures:

- Rapid iteration during spec-first planning
- Increased visibility via PR comments before enforcement
- Quality protection once implementation begins

## Dissenting Views

None recorded.

## Impact

**Positive**:

- Formalizes an ad-hoc decision with council review
- Defines clear, measurable criteria for progression
- Increases visibility with PR comments in Phase 2
- Protects quality baseline once enforcement begins
- Provides exception process for edge cases

**Negative**:

- Generators must resolve issues before Phase 3
- Additional CI time for PR comments in Phase 2
- Requires `--json` output mode in validator (Toolsmith work)

**Affected Terminals**:
| Terminal | Impact |
|----------|--------|
| DevOps | Implements workflow changes |
| Validator | Adds `--json` output mode |
| Generators | Must achieve 100% pass rate |
| Reviewers | Issue backlog must reach 0 |
| Inspector | Cross-SVG consistency contributes to pass rate |
| Toolsmith | Updates validator for JSON output |

## Implementation

- [ ] **Toolsmith**: Add `--json` and `--summary` flags to `validate-wireframe.py`
- [ ] **DevOps**: Update `ci.yml` with PR comment workflow (Phase 2)
- [ ] **Coordinator**: Track Phase 2 exit criteria in `.terminal-status.json`
- [ ] **Generators**: Resolve validation issues to achieve 100% pass rate
- [ ] **DevOps**: Remove `continue-on-error` when Phase 3 criteria met
- [ ] **Author**: Document enforcement policy in project README

## Phase Exit Criteria

### Phase 1 → Phase 2

| Criterion           | Threshold            | Verification Command                                    |
| ------------------- | -------------------- | ------------------------------------------------------- |
| Wireframe count     | ≥ 40 SVGs exist      | `ls docs/design/wireframes/**/*.svg \| wc -l`           |
| Pass rate           | ≥ 80% of SVGs pass   | `validate-wireframe.py --all --summary`                 |
| Issue backlog       | < 50 total issues    | `grep -c "^-" docs/design/wireframes/**/*.issues.md`    |
| Validator stability | No changes in 7 days | `git log --since="7 days ago" -- validate-wireframe.py` |

**All criteria must be met to proceed.**

### Phase 2 → Phase 3

| Criterion            | Threshold            | Verification Command                         |
| -------------------- | -------------------- | -------------------------------------------- |
| Pass rate            | 100% of SVGs pass    | `validate-wireframe.py --all` returns exit 0 |
| Issue backlog        | 0 open issues        | All `*.issues.md` files empty or deleted     |
| Council approval     | CTO sign-off         | Recorded in this document                    |
| Implementation phase | First feature begins | `src/` folder created                        |

**All criteria must be met to proceed.**

### Criteria-Based Progression

Phase transitions are triggered by measurable criteria, not calendar dates. This ensures:

- No artificial deadlines that pressure teams to bypass quality gates
- Clear, verifiable thresholds that can be automated
- Flexibility to iterate as needed during planning

## Council Notes

- **CTO**: The ≥40 SVG threshold may need adjustment; treat as guidance rather than hard requirement
- **Architect**: Consider adding `--check-exceptions` flag to verify exceptions are still valid
- **Security Lead**: Ensure `validation.json` doesn't leak sensitive information
- **Product Owner**: Add Product Owner to quarterly exception review alongside Architect
