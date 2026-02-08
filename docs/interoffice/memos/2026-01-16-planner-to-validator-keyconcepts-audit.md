# DISPATCH: Key Concepts Position Verification

**From**: Planner
**To**: Validator, Inspector
**Date**: 2026-01-16
**Priority**: BLOCKING
**Action**: Audit ALL SVGs for Key Concepts positioning before marking any batch complete

---

## Issue Identified

Screenshot review shows Key Concepts row is:

1. **Too high** (y-axis wrong)
2. **Too close to left edge** (x-axis wrong)

## Expected Pattern (G-047)

```xml
<!-- Option 1: Direct positioning -->
<text x="40" y="940" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">Key Concepts:</text>
<text x="150" y="940" font-family="system-ui, sans-serif" font-size="14" fill="#374151">term1 | term2 | term3</text>

<!-- Option 2: Group transform -->
<g transform="translate(40, 940)">
  <text font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">Key Concepts:</text>
  <text x="110" font-family="system-ui, sans-serif" font-size="14" fill="#374151">term1 | term2 | term3</text>
</g>
```

**Required values:**

- x = 40 (or transform x=40)
- y = 940 (or transform y=940)
- Label fill: `#374151`
- Content fill: `#374151` or `#4b5563`

## Known Violations

| Feature                 | SVG                              | Current Position     | Issue                                      |
| ----------------------- | -------------------------------- | -------------------- | ------------------------------------------ |
| 004-mobile-first-design | 01-responsive-navigation.svg     | `translate(20, 140)` | x=20 (should be 40), y=140 (should be 940) |
| 004-mobile-first-design | 02-touch-targets-performance.svg | `translate(20, 140)` | Same issue                                 |

## Validator Task

Run this check against ALL SVGs:

```bash
# Find Key Concepts with wrong y position (not near 940)
for svg in docs/design/wireframes/*/*.svg; do
  # Check for transform with wrong y
  if grep -q 'Key Concepts' "$svg"; then
    # Extract y value from transform or direct y attribute
    y_val=$(grep -oP 'translate\(\d+,\s*\K\d+' "$svg" | head -1)
    if [ -n "$y_val" ] && [ "$y_val" -lt 900 ]; then
      echo "FAIL: $svg - y=$y_val (should be ~940)"
    fi

    # Check direct y attribute near Key Concepts
    grep -B2 -A2 'Key Concepts' "$svg" | grep -oP 'y="\K\d+' | while read y; do
      if [ "$y" -lt 900 ]; then
        echo "FAIL: $svg - direct y=$y (should be ~940)"
      fi
    done
  fi
done
```

## Inspector Task

After Validator identifies violations, verify:

1. Key Concepts is **inside** annotation panel (y=800 to y=1020)
2. x position provides adequate left margin (x=40 minimum)
3. Content text starts at x=110-150 (after "Key Concepts:" label)

## Classification

| Issue Type            | Classification           | Fix                           |
| --------------------- | ------------------------ | ----------------------------- |
| Wrong y position      | PATCH if simple y change | Update y value                |
| Wrong group transform | REGEN if structural      | Regenerate annotation section |
| Missing Key Concepts  | PATCH                    | Add G-047 row                 |

## Action Required

1. **Validator**: Run position audit, log violations to `.issues.md` files
2. **Inspector**: Cross-check for pattern consistency
3. **BLOCK** Generator batches from being marked complete until Key Concepts verified
4. Report findings back to Planner

---

**Do not approve any SVG until Key Concepts positioning is verified.**
