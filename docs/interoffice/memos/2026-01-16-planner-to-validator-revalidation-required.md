# DISPATCH: Re-Validation Required - Workflow Fix

**From**: Planner
**To**: Validator
**Date**: 2026-01-16
**Priority**: CRITICAL / BLOCKING
**Action**: Re-validate ALL SVGs and update .issues.md files

---

## Problem Identified

**The .issues.md files are stale.** They do not reflect the current SVG state.

### Evidence

| File                                 | .issues.md Says             | SVG Actual State         |
| ------------------------------------ | --------------------------- | ------------------------ |
| 000-landing-page/01-landing-page.svg | G-037 OPEN (#6b7280)        | FIXED (no #6b7280 found) |
| 000-landing-page/01-landing-page.svg | Key Concepts position wrong | FIXED (x=40, y=940)      |

**45 .issues.md files show open issues**, but many SVGs have already been fixed by Generators.

---

## Workflow Breakdown

### What Was Happening (WRONG)

```
1. Validator logs issues to .issues.md     ✓
2. Queue PATCH task to Generator           ✓
3. Generator fixes SVG                     ✓
4. Generator says "done"                   ✓
5. Mark APPROVED in completedToday         ✗ NO VERIFICATION
```

### What Must Happen (CORRECT)

```
1. Validator logs issues to .issues.md     ✓
2. Queue PATCH task to Generator           ✓
3. Generator fixes SVG                     ✓
4. Generator says "done"                   ✓
5. VALIDATOR RE-RUNS VALIDATION            ← NEW STEP
6. Update .issues.md with current state    ← NEW STEP
7. If 0 issues → APPROVED
   If issues remain → Back to Generator
```

---

## Immediate Action Required

### Step 1: Re-validate ALL SVGs

```bash
cd docs/design/wireframes

# Run validation on every SVG
for svg in */*.svg; do
  echo "Validating: $svg"
  python validate-wireframe.py "$svg"
done
```

### Step 2: Update .issues.md Files

For each SVG, the .issues.md must reflect CURRENT state:

- If issue is fixed in SVG → Remove from .issues.md or mark RESOLVED
- If issue still exists → Keep as OPEN
- Add any NEW issues found

### Step 3: Generate Summary Report

After re-validation, report:

```markdown
## Re-Validation Results (2026-01-16)

| Feature          | SVG                 | Previous Issues | Current Issues | Status |
| ---------------- | ------------------- | --------------- | -------------- | ------ |
| 000-landing-page | 01-landing-page.svg | 2               | ?              | ?      |
| ...              | ...                 | ...             | ...            | ...    |

### Summary

- Total SVGs: 45
- PASS (0 issues): X
- FAIL (issues remain): Y
- Newly discovered issues: Z
```

### Step 4: Update .terminal-status.json

Only add to completedToday when .issues.md shows 0 open issues:

```
"Validator: Re-validated [feature] - [N] SVGs, [X] PASS, [Y] FAIL"
```

---

## Validation Checks (Reference)

Validator must check:

| Check         | Expected Value                                   |
| ------------- | ------------------------------------------------ |
| G-037         | No `fill="#6b7280"` in annotation panel          |
| G-044         | Footer/nav have `rx="4-8"`                       |
| G-047         | Key Concepts at `x=40, y=940`                    |
| SIGNATURE-003 | Signature at `x="40"`, no `text-anchor="middle"` |
| SIGNATURE-004 | Format: `NNN:NN \| Feature Name \| ScriptHammer` |

---

## .issues.md Update Format

When updating .issues.md after re-validation:

```markdown
# Issues: [svg-name].svg

**Feature:** [feature]
**SVG:** [svg-name].svg
**Last Review:** 2026-01-16
**Validator:** v5.0

---

## Summary

| Status   | Count |
| -------- | ----- |
| Open     | 0     |
| Resolved | 3     |

---

## Resolved Issues (2026-01-16)

| ID   | Issue                         | Resolution Date |
| ---- | ----------------------------- | --------------- |
| A-01 | G-037 color fixed             | 2026-01-16      |
| A-02 | G-047 Key Concepts positioned | 2026-01-16      |
| A-03 | SIGNATURE-003 left-aligned    | 2026-01-16      |

---

## Open Issues

None - SVG APPROVED

---

## Notes

- Re-validated after Generator1 PATCH batch
- All issues resolved, approved for production
```

---

## DO NOT

- Mark APPROVED without re-running validation
- Trust "Generator says done" without verification
- Leave stale .issues.md files

## MUST DO

- Re-run `validate-wireframe.py` on EVERY SVG
- Update .issues.md to reflect actual SVG state
- Only APPROVED when Open Issues = 0

---

## Expected Output

After completing this dispatch, report back:

```
Re-validation complete:
- X SVGs now APPROVED (0 issues)
- Y SVGs still have issues (list them)
- Z new issues discovered

Updated .issues.md files: [list]
```

---

**This is a BLOCKING task. No SVG should be considered complete until .issues.md reflects actual state.**
