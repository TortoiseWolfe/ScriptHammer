# RFC-004: CI Wireframe Validation Enforcement Timeline

**Status**: decided
**Author**: DevOps
**Created**: 2026-01-15
**Target Decision**: 2026-01-22

## Stakeholders (Consensus Required)

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-15 |
| Architect     | approve | 2026-01-15 |
| Security Lead | approve | 2026-01-15 |
| Toolsmith     | approve | 2026-01-15 |
| DevOps        | approve | 2026-01-15 |
| Product Owner | approve | 2026-01-15 |

**Required**: All non-abstaining stakeholders must approve

---

## Summary

Formalize the enforcement timeline for CI wireframe validation in `.github/workflows/ci.yml`. Define concrete criteria for transitioning from the current **Planning phase** (soft-fail) to **Enforcement phase** (hard-fail), ensuring validation errors block PRs only when the project is ready.

---

## Motivation

### Background

In commit `7afb6b9` (2026-01-14), DevOps set `continue-on-error: true` for the `validate-wireframes` job without formal council review:

```yaml
# .github/workflows/ci.yml:46-52
- name: Validate all wireframes
  run: python docs/design/wireframes/validate-wireframe.py --all
  # Enforcement timeline:
  # - Planning phase (current): continue-on-error=true, validation runs but doesn't block
  # - Transition phase: Add issue counts to PR comments
  # - Enforcement phase: Remove continue-on-error to block PRs with errors
  continue-on-error: true
```

### Problems with Current State

1. **No formal review** - Decision was bundled with org audit commit, not explicitly approved
2. **Undefined triggers** - No criteria specified for when to move between phases
3. **Cross-terminal impact** - Affects Validator, Generators, Reviewers, Inspector without their input
4. **Quality risk** - Soft-fail means validation issues may accumulate unnoticed

### Why This Matters

The `validate-wireframe.py` script (v5.2+) runs 30+ automated checks including:

- SVG structure and XML validity
- Color compliance (`#e8d4b8` panel backgrounds, no white)
- Typography standards (Inter font, size hierarchy)
- Layout rules (canvas 1920x1080, desktop/mobile positioning)
- Accessibility (touch targets, contrast, annotations)

Without enforcement, these standards become advisory suggestions rather than quality gates.

---

## Proposal

### Three-Phase Enforcement Model

#### Phase 1: Planning (Current)

**Configuration**: `continue-on-error: true`

**Behavior**:

- Validation runs on every PR and push to main
- Failures logged but do not block merge
- Results visible in GitHub Actions logs

**Purpose**: Allow rapid wireframe iteration during spec-first planning without friction.

**Exit Criteria** (ALL must be met to proceed to Phase 2):
| Criterion | Threshold | Verification |
|-----------|-----------|--------------|
| Wireframe count | ≥ 40 SVGs exist | `ls docs/design/wireframes/**/*.svg \| wc -l` |
| Pass rate | ≥ 80% of SVGs pass validation | `validate-wireframe.py --all --summary` |
| Issue backlog | < 50 total issues in `*.issues.md` files | `grep -c "^-" docs/design/wireframes/**/*.issues.md` |
| Validator stability | No changes to `validate-wireframe.py` in 7 days | Git history check |

---

#### Phase 2: Transition

**Configuration**: `continue-on-error: true` (unchanged)

**Behavior**:

- Validation runs on every PR
- Failures still do not block merge
- **NEW**: Issue counts posted as PR comment via GitHub Actions

**Implementation**:

```yaml
- name: Validate all wireframes
  id: validate
  run: |
    python docs/design/wireframes/validate-wireframe.py --all --json > validation.json
  continue-on-error: true

- name: Comment validation results
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const results = JSON.parse(fs.readFileSync('validation.json'));
      const body = `## Wireframe Validation Results
      - **Pass**: ${results.passed} SVGs
      - **Fail**: ${results.failed} SVGs
      - **Issues**: ${results.total_issues}

      _Enforcement pending. See [RFC-004] for timeline._`;
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: body
      });
```

**Purpose**: Increase visibility without blocking. Give Generators time to resolve issues before enforcement.

**Exit Criteria** (ALL must be met to proceed to Phase 3):
| Criterion | Threshold | Verification |
|-----------|-----------|--------------|
| Pass rate | 100% of SVGs pass validation | `validate-wireframe.py --all` returns exit code 0 |
| Issue backlog | 0 open issues in `*.issues.md` files | All issues resolved or documented as exceptions |
| Council approval | CTO signs off on enforcement readiness | Recorded in this RFC |
| Implementation phase | First feature begins implementation | `src/` folder created |

---

#### Phase 3: Enforcement

**Configuration**: Remove `continue-on-error: true`

**Behavior**:

- Validation runs on every PR
- **Failures block merge** until resolved
- PR cannot be merged with validation errors

**Implementation**:

```yaml
- name: Validate all wireframes
  run: python docs/design/wireframes/validate-wireframe.py --all
  # No continue-on-error - failures block PRs
```

**Purpose**: Protect quality baseline. Prevent regression as implementation begins.

**Exception Process**:
If a validation error cannot be immediately fixed:

1. Create `*.exception.md` documenting the reason
2. Add `<!-- validation-exception: REASON -->` comment to SVG
3. Validator ignores files with documented exceptions
4. Exceptions reviewed quarterly by Architect

---

### Timeline Estimate

| Phase       | Estimated Duration | Trigger                       |
| ----------- | ------------------ | ----------------------------- |
| Planning    | Current → TBD      | Exit criteria met             |
| Transition  | 1-2 weeks          | PR comment workflow added     |
| Enforcement | Ongoing            | 100% pass rate + CTO approval |

**Note**: No calendar dates committed. Progression is criteria-based, not time-based.

---

### Monitoring Dashboard

Add to `.claude/inventories/workflow-status.md`:

```markdown
## Wireframe Validation Status

| Metric                      | Current | Phase 2 Target | Phase 3 Target |
| --------------------------- | ------- | -------------- | -------------- |
| SVG Count                   | XX      | ≥ 40           | ≥ 40           |
| Pass Rate                   | XX%     | ≥ 80%          | 100%           |
| Open Issues                 | XX      | < 50           | 0              |
| Days Since Validator Change | XX      | ≥ 7            | -              |
```

---

## Alternatives Considered

### 1. Immediate Enforcement

**Rejected**: Would block all PRs immediately. Current pass rate likely < 100%, causing friction and blocking legitimate work.

### 2. Never Enforce (Advisory Only)

**Rejected**: Standards become meaningless without enforcement. Quality degrades over time as "temporary" violations become permanent.

### 3. Per-Feature Enforcement

Enforce only on features past a certain stage (e.g., wireframes complete, implementation started).

**Rejected**: Complex to implement. Feature-level gating adds CI configuration overhead. Project-wide enforcement is simpler.

### 4. Manual Gate (No Automation)

Require Validator terminal to approve PRs manually.

**Rejected**: Doesn't scale. Creates bottleneck. Automation is more reliable than manual process.

---

## Impact Assessment

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

---

## Implementation Checklist

If approved, the following work is required:

- [x] **Toolsmith**: Add `--json` and `--summary` flags to `validate-wireframe.py` _(done: v5.3)_
- [x] **DevOps**: Update `ci.yml` with PR comment workflow (Phase 2) _(done: commit 056dddd)_
- [ ] **Coordinator**: Track Phase 2 exit criteria in `.terminal-status.json`
- [x] **Generators**: Resolve validation issues to achieve 100% pass rate _(done: 35/35 SVGs pass)_
- [ ] **DevOps**: Remove `continue-on-error` when Phase 3 criteria met _(blocked: awaiting CTO sign-off + src/ folder)_
- [ ] **Author**: Document enforcement policy in project README

---

## Discussion Thread

### DevOps (2026-01-15)

**Vote: APPROVE**

As the author and original decision-maker, I acknowledge the `continue-on-error: true` setting should have been formally reviewed. This RFC corrects that oversight.

Key points:

1. **Criteria-based progression is correct** - Calendar-based deadlines don't account for actual readiness. The measurable thresholds (≥80% pass rate, <50 issues) give us flexibility while ensuring quality gates are meaningful.
2. **PR comments in Phase 2 increase visibility** - Currently validation results are buried in GitHub Actions logs. Surfacing them directly on PRs will drive accountability.
3. **Exception process is necessary** - Some edge cases need documented escape hatches. Quarterly Architect review prevents exception abuse.

---

### CTO (2026-01-15)

**Vote: APPROVE**

This RFC addresses a process gap I should have caught during the org audit. Infrastructure decisions affecting multiple terminals warrant formal review.

1. **Formalizing ad-hoc decisions sets good precedent** - Undocumented decisions become technical debt.
2. **Phase 2 exit criteria are appropriate** - Requiring CTO sign-off before enforcement ensures strategic alignment.
3. **Implementation phase trigger is smart** - Tying enforcement to `src/` folder creation ensures wireframes are locked down before code references them.

Note: The ≥40 SVG threshold may need adjustment. Recommend treating it as guidance rather than hard requirement.

---

### Architect (2026-01-15)

**Vote: APPROVE**

From an architectural perspective, this RFC follows sound principles:

1. **Progressive enforcement is correct** - Shifting from soft-fail to hard-fail mirrors schema migrations: warn first, then enforce.
2. **Measurable criteria enable automation** - Exit criteria can be computed programmatically for future automation.
3. **Exception process preserves flexibility** - The `*.exception.md` pattern balances flexibility with accountability.

Suggestion: Add `--check-exceptions` flag to verify exceptions are still valid.

---

### Security Lead (2026-01-15)

**Vote: APPROVE**

1. **Quality gates are security controls** - Validation checks include accessibility requirements with compliance implications.
2. **Criteria-based progression reduces risk** - Time-based deadlines create pressure to bypass controls.
3. **Exception audit trail is important** - Documentation for deviations with quarterly review.

Note: Ensure `validation.json` doesn't leak sensitive information.

---

### Toolsmith (2026-01-15)

**Vote: APPROVE**

Implementation assessment:

1. **`--json` flag is straightforward** - ~50 lines of Python to expose existing pass/fail counts.
2. **`--summary` flag adds value** - Helps Generators quickly assess progress.
3. **Exception handling needs design** - Will create spec before implementing comment detection.

Estimate: 2-3 sessions for full implementation.

---

### Product Owner (2026-01-15)

**Vote: APPROVE**

1. **Wireframe validation ensures spec compliance** - Enforcement means users see consistent, accessible interfaces.
2. **Phase 2 visibility helps prioritization** - PR comments help understand which features have issues.
3. **100% pass rate before implementation is correct** - Catching problems at wireframe stage is cheaper.

Suggestion: Add Product Owner to quarterly exception review alongside Architect.

---

## Dissent Log

_Logged for transparency even if overruled_

---

## Decision Record

**Decided**: 2026-01-15
**Outcome**: approved
**Decision ID**: DEC-004
