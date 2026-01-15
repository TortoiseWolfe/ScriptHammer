# Wireframe Pipeline Context

**Pipeline roles**: Planner, WireframeGenerator 1/2/3, PreviewHost, WireframeQA, Validator, Inspector

## Pipeline Flow

```
Planner → Generators (3 parallel) → PreviewHost → WireframeQA → Validator → Inspector
    ↑                                                              ↓
    └──────────────────── issues (feedback loop) ←─────────────────┘
```

## Role Responsibilities

| Role | Job | Key Skill |
|------|-----|-----------|
| Planner | Analyze spec, create SVG assignments | `/wireframe-plan [feature]` |
| Generator 1/2/3 | Create SVGs, fix validation errors | `/wireframe [feature]` |
| PreviewHost | Run viewer for screenshots | `/hot-reload-viewer` |
| WireframeQA | Screenshot and document issues | `/wireframe-screenshots` |
| Validator | Run validation, manage escalation | `validate-wireframe.py` |
| Inspector | Cross-SVG consistency checks | `inspect-wireframes.py` |

## SVG Rules

- Canvas: `viewBox="0 0 1920 1080"`
- Desktop: x=40, y=60, 1280x720
- Mobile: x=1360, y=60, 360x720
- Panel color: `#e8d4b8` (never `#ffffff`)
- Touch targets: 44px minimum

## MANDATORY SVG HEADER

**COPY THIS EXACTLY** - do not type from memory (G-040, G-041, G-042):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c7ddf5"/>
      <stop offset="100%" stop-color="#b8d4f0"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <text x="960" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#1f2937">FEATURE - PAGE</text>
```

**Critical**: `height="1080"` NOT `height="1920"`. All attributes must use `"` quotes, no trailing commas.

**Signature**: Must be LEFT-ALIGNED at `x="40"`, NOT centered. No `text-anchor="middle"`.
```xml
<text x="40" y="1060" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#374151">NNN:NN | Feature | ScriptHammer</text>
```

## Issue Classification

| Type | Examples | Action |
|------|----------|--------|
| PATCH | Wrong color, typo | Quick fix |
| REGEN | Layout problems, overlapping | Full regenerate |

## Key Files

| File | Purpose |
|------|---------|
| `.terminal-status.json` | Queue and assignments |
| `GENERAL_ISSUES.md` | Recurring mistakes (G-XXX) |
| `NNN-feature/*.issues.md` | Per-feature issues |

## Queue Check

```bash
cat docs/design/wireframes/.terminal-status.json | jq '.queue[] | select(.assignedTo | contains("generator"))'
```
