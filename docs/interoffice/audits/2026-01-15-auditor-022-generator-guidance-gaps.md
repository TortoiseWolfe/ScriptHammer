# Audit: 022-web3forms-integration Generator Guidance Gaps

**Date**: 2026-01-15
**Auditor**: Auditor Terminal
**Feature**: 022-web3forms-integration
**Subject**: Root cause analysis of wireframe issues

---

## Executive Summary

The 022-web3forms-integration wireframes have **136 total issues** (52 + 84). Analysis reveals these are **not novel errors** - nearly all are violations of existing documented rules. The root cause is **guidance compliance failure**, not missing guidance.

---

## Issue Breakdown

### 01-contact-form-ui.svg (52 issues)

| Category                       | Count | Code          | Classification |
| ------------------------------ | ----- | ------------- | -------------- |
| XML attribute errors           | 3     | XML-004       | REGENERATE     |
| Wrong SVG height               | 1     | SVG-003       | REGENERATE     |
| Signature too small            | 1     | SIGNATURE-001 | REGENERATE     |
| Signature not bold             | 1     | SIGNATURE-002 | REGENERATE     |
| Missing header/footer includes | 1     | HDR-001       | REGENERATE     |
| Missing annotation panel       | 1     | ANN-001       | REGENERATE     |
| Transparent buttons            | 3     | BTN-001       | REGENERATE     |
| Missing background gradient    | 1     | G-022         | REGENERATE     |
| Font size below 14px           | 40    | FONT-001      | PATCH          |

### 02-submission-states.svg (84 issues)

| Category                       | Count | Code          | Classification |
| ------------------------------ | ----- | ------------- | -------------- |
| XML attribute errors           | 3     | XML-004       | REGENERATE     |
| Wrong SVG height               | 1     | SVG-003       | REGENERATE     |
| Forbidden panel color          | 1     | G-001         | REGENERATE     |
| Signature too small            | 1     | SIGNATURE-001 | REGENERATE     |
| Signature not bold             | 1     | SIGNATURE-002 | REGENERATE     |
| Missing header/footer includes | 1     | HDR-001       | REGENERATE     |
| Missing annotation panel       | 1     | ANN-001       | REGENERATE     |
| Transparent buttons            | 5     | BTN-001       | REGENERATE     |
| Missing background gradient    | 1     | G-022         | REGENERATE     |
| Font size below 14px           | 69    | FONT-001      | PATCH          |

---

## Guidance Gap Analysis

### Category 1: DOCUMENTED BUT VIOLATED

These rules exist in GENERAL_ISSUES.md, templates, or CLAUDE.md but were not followed.

| Issue                       | Documentation Location                      | Assessment                  |
| --------------------------- | ------------------------------------------- | --------------------------- |
| G-001 (Panel colors)        | GENERAL_ISSUES.md line 11                   | **Rule exists**, ignored    |
| G-022 (Background gradient) | GENERAL_ISSUES.md line 31, template line 13 | **Rule exists**, ignored    |
| G-038 (Signature bold)      | GENERAL_ISSUES.md line 43                   | **Rule exists**, ignored    |
| Header/footer includes      | Template lines 30-32, 39-41                 | **Pattern exists**, ignored |
| BTN-001 (Button fills)      | GENERAL_ISSUES.md G-015 lines 239-274       | **Rule exists**, ignored    |
| FONT-001 (14px minimum)     | GENERAL_ISSUES.md G-010 lines 135-152       | **Rule exists**, ignored    |
| Annotation panel structure  | Template lines 45-48                        | **Pattern exists**, ignored |

**Finding**: 7/9 issue categories have existing documentation. The generator simply did not follow it.

### Category 2: UNDERDOCUMENTED

| Issue                         | Gap                                                      | Recommendation                                                    |
| ----------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| XML-004 (Unquoted attributes) | No XML syntax validation rules                           | Add "XML Syntax Rules" section to GENERAL_ISSUES.md               |
| SVG-003 (Wrong height)        | Template shows `height="1080"` but no "CRITICAL" callout | Add "MANDATORY SVG HEADER" section with verbatim copy requirement |
| SIGNATURE-001 (18px font)     | Template shows 18px but not in checklist                 | Add to pre-generation checklist                                   |

---

## Root Cause Analysis

### Primary Cause: Template Compliance Failure

The generator is **writing inline SVG from scratch** instead of **copying the template structure**. Evidence:

1. Missing `<defs>` with background gradient (template line 6-11)
2. Missing `<use>` include references (template lines 30-32, 39-41)
3. Wrong `height` attribute (template shows 1080, generator used 1920)
4. No annotation panel with `id="annotations"` (template lines 45-48)

### Secondary Cause: Font Size Drift

109 font issues across both files. The generator uses "visually reasonable" sizes (10-13px) instead of the documented 14px minimum. This suggests the generator:

1. Does not consult GENERAL_ISSUES.md G-010 before generating
2. Optimizes for aesthetics over compliance
3. Uses smaller fonts for annotation text without checking rules

### Tertiary Cause: Attribute Typos

`y='60,'` with trailing comma is a syntax error, not a pattern issue. This indicates:

1. No XML validation before writing
2. Generator may be interpolating values incorrectly

---

## Gap Assessment Summary

| Gap Type           | Count | Action Required                         |
| ------------------ | ----- | --------------------------------------- |
| No documentation   | 2     | Add XML rules, MANDATORY HEADER section |
| Weak documentation | 1     | Promote SIGNATURE-001 to checklist      |
| Compliance failure | 7     | Enforcement mechanism needed            |

**Conclusion**: Documentation gaps are minimal. The real problem is **enforcement**, not documentation.

---

## Recommendations

### 1. Template Enforcement (HIGH PRIORITY)

Add to wireframe-pipeline.md or /wireframe skill:

```
MANDATORY: Every SVG MUST begin with this exact header block:
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c7ddf5"/>
      <stop offset="100%" stop-color="#b8d4f0"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
```

### 2. Add XML Syntax Rules to GENERAL_ISSUES.md

```markdown
## XML Syntax Rules (NEW)

| #     | Mistake                            | Correct                            |
| ----- | ---------------------------------- | ---------------------------------- |
| G-040 | Unquoted attributes: `y=60,`       | Always quote: `y="60"`             |
| G-041 | Trailing commas in values: `"60,"` | Clean values: `"60"`               |
| G-042 | Missing xmlns declarations         | Include both xmlns and xmlns:xlink |
```

### 3. Update Pre-Generation Checklist

Add to GENERAL_ISSUES.md checklist:

```markdown
- [ ] SVG header: viewBox="0 0 1920 1080" width="1920" height="1080"
- [ ] Background gradient defined AND used: fill="url(#bg)"
- [ ] Include `<use>` elements for header/footer (not inline SVG)
- [ ] Signature: y=1060, 18px, font-weight="bold"
- [ ] All text elements: font-size >= 14px
- [ ] Annotation panel: id="annotations" present
```

### 4. Validator Pre-Flight Check (TOOLSMITH)

Request to Toolsmith: Modify validate-wireframe.py to run a **quick pre-flight check** that catches structural issues BEFORE detailed validation:

```python
def preflight_check(svg_path):
    """Fast structural validation before full check."""
    errors = []
    content = open(svg_path).read()

    # Check header
    if 'viewBox="0 0 1920 1080"' not in content:
        errors.append("PREFLIGHT: Wrong viewBox")
    if 'height="1080"' not in content:
        errors.append("PREFLIGHT: Wrong height (must be 1080)")
    if 'fill="url(#bg)"' not in content:
        errors.append("PREFLIGHT: Background gradient not used")
    if 'id="annotations"' not in content:
        errors.append("PREFLIGHT: Missing annotation panel")

    return errors
```

---

## Cross-Reference to Existing Issues

| This Audit Finding   | Related GENERAL_ISSUES Entry | Status            |
| -------------------- | ---------------------------- | ----------------- |
| Font size below 14px | G-010                        | Already escalated |
| Signature not bold   | G-038                        | Already escalated |
| Panel color wrong    | G-001                        | Already escalated |
| Missing gradient     | G-022                        | Already escalated |
| Buttons transparent  | G-015                        | Already escalated |

All major issues have been escalated to GENERAL_ISSUES.md. The problem is not documentation - it's **generator reading and following that documentation**.

---

## Action Items

| #   | Action                                                          | Owner     | Priority |
| --- | --------------------------------------------------------------- | --------- | -------- |
| 1   | Add XML syntax rules (G-040, G-041, G-042) to GENERAL_ISSUES.md | Validator | P1       |
| 2   | Add "MANDATORY SVG HEADER" section to wireframe-pipeline.md     | Validator | P1       |
| 3   | Update pre-generation checklist in GENERAL_ISSUES.md            | Validator | P1       |
| 4   | Add pre-flight check to validate-wireframe.py                   | Toolsmith | P2       |
| 5   | RFC: Generator must READ GENERAL_ISSUES.md as first step        | Council   | P2       |

---

## Verdict

**Documentation gaps**: Minimal (2-3 items)
**Compliance failure**: Systemic

The 022-web3forms-integration issues are symptomatic of a broader pattern: generators are not following existing guidance. The fix is:

1. Minor documentation updates (XML rules, header enforcement)
2. Process change: **mandatory GENERAL_ISSUES.md consultation before generation**
3. Technical enforcement via pre-flight validation

---

_Audit complete. Findings persisted for cross-session reference._
