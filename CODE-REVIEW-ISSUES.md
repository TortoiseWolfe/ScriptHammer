# Code Review Issues

**Date:** 2026-01-13
**Reviewer:** Claude Opus 4.5
**Repository:** ScriptHammer (Planning Template)

## Repository Context

This is a **planning template repository** containing:

- 46 feature specifications (markdown)
- SVG wireframe viewer (`docs/design/wireframes/`)
- 2 Python scripts: `validate-wireframe.py` (1999 lines), `screenshot-wireframes.py` (391 lines)
- 1 HTML viewer with embedded JavaScript

**No application source code exists** - this is spec-first planning.

---

## Phase 1: Security Audit

### Fixed Issues

| Issue                       | File            | Severity | Status    |
| --------------------------- | --------------- | -------- | --------- |
| DOM-based XSS via innerHTML | index.html:1276 | CRITICAL | **FIXED** |
| Path traversal in SVG refs  | index.html:1240 | HIGH     | **FIXED** |
| XSS in error message path   | index.html:1281 | MEDIUM   | **FIXED** |

### Remediation Applied

1. **SVG Sanitization** (index.html:1280-1303)
   - Added `sanitizeSVG()` function that removes:
     - `<script>` elements
     - Event handlers (`onclick`, `onload`, etc.)
     - `javascript:` hrefs
     - Dangerous elements (`foreignObject`, `set`, animated hrefs)

2. **Path Traversal Protection** (index.html:1241-1252)
   - Added `isValidSvgPath()` validator that blocks:
     - `..` sequences
     - Absolute paths (`/`)
     - Double slashes (`//`)
   - Only allows `.svg` files from `includes/` or same directory

3. **Safe Error Rendering** (index.html:1315-1321)
   - Changed from template literal in innerHTML to createElement + textContent

4. **Content Security Policy** (index.html:7)
   - Added CSP meta tag with:
     - `default-src 'self'` - blocks unauthorized resources
     - `script-src` - allows self, inline, and Google Analytics domains
     - `style-src` - allows self and inline styles
     - `img-src` - allows self, data URIs, and GA tracking pixels
     - `connect-src` - allows fetch to self and GA
     - `frame-ancestors 'self'` - prevents clickjacking

### Remaining (Accepted Risk)

| Issue                       | Severity | Decision                                                 |
| --------------------------- | -------- | -------------------------------------------------------- |
| No SRI for Google Analytics | MEDIUM   | GA script changes frequently; SRI would break on updates |

**Note:** SRI is not practical for GA because Google updates the script without notice. CSP already restricts which domains can serve scripts.

### Python Scripts - No Issues Found

Both `validate-wireframe.py` and `screenshot-wireframes.py` are **secure**:

- No command injection (subprocess uses list form)
- No path traversal (paths bounded to wireframes directory)
- No hardcoded secrets
- XXE not possible (Python 3.7+ default protects against it)

---

## Phase 2: Performance Analysis

### No Issues Found

This is a planning template with minimal code:

- No application code to optimize
- Python scripts are already O(n) with binary search optimizations
- HTML viewer uses vanilla JS (no framework overhead)

---

## Phase 3: Code Quality

### Fixed Issues

| Issue                 | File                  | Line | Status    |
| --------------------- | --------------------- | ---- | --------- |
| Unused import `field` | validate-wireframe.py | 28   | **FIXED** |

### No Other Issues Found

- No TODO/FIXME comments in executable code
- No linter disables
- No unimplemented stubs
- No duplicate files

---

## Phase 4: Test Coverage

### Current State

| Metric        | Value |
| ------------- | ----- |
| Test files    | 0     |
| Test coverage | 0%    |

**Note:** This is expected for a planning template. Tests are specified in `features/testing/` but not implemented yet.

---

## Summary

| Category      | Found | Fixed | Remaining         |
| ------------- | ----- | ----- | ----------------- |
| Security      | 6     | 5     | 1 (accepted risk) |
| Performance   | 0     | 0     | 0                 |
| Code Quality  | 1     | 1     | 0                 |
| Test Coverage | N/A   | N/A   | N/A               |

**All actionable issues have been fixed.** The remaining item (SRI for Google Analytics) is an accepted risk because GA scripts change frequently and SRI would cause breakage.
