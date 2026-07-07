# Validator Gap Analysis: 15 "Clean" SVGs

**Date:** 2026-01-16
**Analyst:** Validator Terminal
**Task:** Validate 15 SVGs that QC found issues in - determine validator completeness

---

## Validation Results

| #   | SVG    | Validator    | Expected Issues (QC) |
| --- | ------ | ------------ | -------------------- |
| 1   | 001:01 | PASS         | G-044, G-047         |
| 2   | 002:01 | PASS         | G-044, G-047         |
| 3   | 002:03 | PASS         | G-044, G-047         |
| 4   | 004:01 | PASS         | G-044, G-047         |
| 5   | 004:02 | PASS         | G-044, G-047         |
| 6   | 005:02 | PASS         | G-044, G-047         |
| 7   | 005:03 | PASS         | G-044, G-047         |
| 8   | 006:01 | PASS         | G-044, G-047         |
| 9   | 013:01 | PASS         | G-044, G-047         |
| 10  | 013:02 | PASS         | G-044, G-047         |
| 11  | 016:01 | **FAIL** (3) | SIGNATURE-003/004    |
| 12  | 017:01 | PASS         | G-044, G-047         |
| 13  | 017:02 | PASS         | G-044, G-047         |
| 14  | 019:01 | PASS         | G-044, G-047         |
| 15  | 019:02 | PASS         | G-044, G-047         |

**Result:** 14/15 PASS when they should FAIL

---

## Validator Gaps Identified

### 1. G-044 (Footer/Nav Corners) - Partial Detection

**Why it passes:**

- Wireframes use `<use href="includes/footer-desktop.svg"/>` to include footers
- Validator regex looks for inline `<rect>` elements with specific y/width patterns
- Cannot see into `<use>` referenced files
- Active state overlays have width=90, not 340-369 (pattern misses them)

**Evidence from 004:01:**

```xml
<!-- Line 99: Uses include - validator can't see rx -->
<use href="includes/footer-desktop.svg#site-footer" x="0" y="640"/>

<!-- Line 166: Active overlay - width=90 misses pattern -->
<rect x="90" y="664" width="90" height="56" fill="#8b5cf6"/>
```

**Gap:** G-044 check ONLY works when footers are inline `<rect>` elements. Most wireframes use includes.

### 2. G-047 (Key Concepts Row) - NO CHECK EXISTS

**What should be checked:**

- "Key Concepts:" label exists at y≈730
- Consistent label (not "Additional Requirements:")
- Proper spacing (20px gap above/below)
- No hand-drawn annotation lines

**Current status:** Validator has NO G-047 check

### 3. Mobile Active State Overlay (G-045/G-046) - Partial Detection

**What's missed:**

- Active state overlay at y=664 with width=90 should have rx
- Icon missing from active state (text only)
- Corner tabs using `<rect>` instead of `<path>`

**Gap:** Pattern too narrow - only matches full-width nav bars, not individual tab overlays

### 4. Annotation Panel Hand-Drawn Elements - NO CHECK

**Observed in QC:**

- Hand-drawn blue arrows in annotation area
- Underlines and circles around callouts
- These are likely debug/review artifacts that should be removed

**Gap:** No check for non-standard annotation elements

---

## Validator Pattern Issues

### Desktop Footer Pattern (Line 1579)

```python
desktop_footer_pattern = r'<rect[^>]*\by=["\']?(6[4-9]\d|7[0-7]\d)["\']?[^>]*width=["\']?(1[0-2]\d\d)["\']?[^>]*'
```

- Looks for y=640-779 and width=1000-1299
- Misses `<use>` includes
- Misses footers with different width

### Mobile Nav Pattern (Line 1595)

```python
mobile_nav_pattern = r'<rect[^>]*\by=["\']?(66[4-9]|6[7-9]\d|7[0-1]\d)["\']?[^>]*width=["\']?(3[4-6]\d)["\']?[^>]*'
```

- Looks for y=664-719 and width=340-369
- Misses active state overlays (width=90)
- Misses `<use>` includes

---

## Recommendations

### Priority 1: Add G-047 Check

```python
def _check_key_concepts_row(self):
    """G-047: Key Concepts row should be consistent."""
    # Check for "Key Concepts:" text
    if not re.search(r'Key Concepts:', self.svg_content):
        self.issues.append(Issue(
            severity="WARNING",
            code="G-047",
            message="Missing 'Key Concepts:' row in annotation panel"
        ))
    # Check for inconsistent label
    if re.search(r'Additional Requirements:', self.svg_content):
        self.issues.append(Issue(
            severity="WARNING",
            code="G-047",
            message="Use 'Key Concepts:' not 'Additional Requirements:'"
        ))
```

### Priority 2: Fix G-044 Pattern

- Check for `<use href=".*footer.*"` elements
- Expand width patterns to catch active state overlays
- Or: Check the include files themselves

### Priority 3: Add Annotation Artifact Check

- Detect hand-drawn elements (freeform paths, non-standard circles)
- Flag for manual review

---

## Summary

| Check                | Status  | Gap                      |
| -------------------- | ------- | ------------------------ |
| SIGNATURE-003/004    | WORKING | None                     |
| G-044 (inline rect)  | WORKING | Misses `<use>` includes  |
| G-044 (overlays)     | BROKEN  | Width pattern too narrow |
| G-047                | MISSING | No check exists          |
| G-045/046            | PARTIAL | Only catches some cases  |
| Hand-drawn artifacts | MISSING | No check exists          |

**Conclusion:** Validator is incomplete. 14 SVGs passed that should have failed. Visual QC remains essential until validator is enhanced.
