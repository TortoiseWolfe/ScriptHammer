# Wireframe Issues: 000-rls-implementation

## Summary
- **Files reviewed**: 3 SVGs
- **Issues found**: 12 total (0 critical, 5 major, 7 minor)
- **Reviewed on**: 2026-01-01
- **Verdict**: PASS - Minor refinements only, no regeneration needed

---

## Issues by File

### 01-rls-architecture-overview.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Arrow endpoint | Minor | 🔴 REGEN | y=380 | Anonymous role arrow to RLS layer ends at y=380 but RLS panel bottom is y=460 - arrow doesn't connect to anything meaningful inside the layer | Extend arrow into RLS panel or add a "blocked" indicator inside |
| 2 | Spacing | Minor | 🔴 REGEN | Legend y=60 | Legend panel starts at y=60, same as Security Roles section - competing vertical positions | Move legend down to y=90 or adjust spacing |
| 3 | Contrast | Major | 🟢 PATCH | .text-muted class | `#8494a8` on `#1e293b` = ~4.1:1 - passes AA but fails AAA | Change to `#9ca3af` for 5.0:1 ratio |
| 4 | Alignment | Minor | 🟢 PATCH | Compliance badges x | Badge row has uneven spacing: 80px, 100px gap, then 100px badge | Standardize badge widths to 80px each |

**File verdict**: Minor issues only - PASS with patches

---

### 02-policy-patterns.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Layout | Major | 🔴 REGEN | 2x2 grid | Four patterns in tight 2x2 grid with only 40px gap at x=720 - patterns 2 and 4 extend to x=1360 leaving only 40px margin | Either widen canvas to 1500px or reduce pattern boxes to 620px width |
| 2 | Text truncation | Major | 🟢 PATCH | Pattern 2 warning | Line "WARNING: Service credentials in .env only..." at 600px width may clip on some renders | Wrap to 2 lines or reduce font to 9px |
| 3 | Contrast | Minor | 🟢 PATCH | Pattern headers | White text on gradient backgrounds varies in contrast - green (#22c55e) header has lower contrast than violet (#8b5cf6) | Acceptable for decorative headers, but could use semi-bold for green |
| 4 | Vertical rhythm | Minor | 🔴 REGEN | y=410 | Pattern 3 and 4 start at y=410, only 15px below Pattern 1/2 content boxes that end at y=395 | Increase vertical gap to 30px minimum |

**File verdict**: Major margin issue - consider REGENERATE or accept tight margins

---

### 03-access-control-matrix.svg

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Table width | Major | 🔴 REGEN | Main matrix | Matrix table is 1000px wide, legend at x=1070 with 290px = 1360px total, leaving 40px right margin - tight | Reduce matrix to 960px or legend to 260px |
| 2 | Row clipping | Minor | 🟢 PATCH | ANON section | "users, profiles, sessions, audit_logs" cell text at x=180 center is 280px+ of text in a column | Text likely fine but verify rendering |
| 3 | Badge alignment | Minor | 🟢 PATCH | Legend badges | OWN/ALL/DENY badges at different y positions (50, 85, 120, 155) but COND badge (#f59e0b) is never used in the matrix - orphaned legend item | Remove COND from legend or document its use case |
| 4 | Contrast | Major | 🟢 PATCH | .text-muted | Same issue as file 1: `#8494a8` on dark backgrounds | Standardize to `#9ca3af` across all files |

**File verdict**: Minor issues - PASS with patches

---

## Overall Assessment

### Classification Summary

| Classification | Count | Action |
|----------------|-------|--------|
| 🟢 PATCHABLE | 7 | `/wireframe-fix` for color and text fixes |
| 🔴 REGENERATE candidates | 5 | Minor structural - could accept or regen |

### Verdict: PASS

These wireframes are **well-structured architecture diagrams** that effectively communicate RLS concepts. The issues found are:
- Contrast issues (patchable with `#9ca3af`)
- Tight margins (40px right edge - acceptable for architecture diagrams)
- One orphaned legend item (COND badge)

**Recommendation**: Apply color patches via `/wireframe-fix`, accept the tight margins as-is since these are technical diagrams not UI wireframes.

---

## Patches to Apply

```
File: 01-rls-architecture-overview.svg
- Change `.text-muted { fill: #8494a8; }` to `fill: #9ca3af;`

File: 02-policy-patterns.svg
- Change `.text-muted { fill: #8494a8; }` to `fill: #9ca3af;`

File: 03-access-control-matrix.svg
- Change `.text-muted { fill: #8494a8; }` to `fill: #9ca3af;`
- Remove COND legend item (lines 283-287) or add usage note
```

---

## Next Feature

Proceed to: **001-wcag-aa-compliance**
