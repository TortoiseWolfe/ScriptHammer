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
