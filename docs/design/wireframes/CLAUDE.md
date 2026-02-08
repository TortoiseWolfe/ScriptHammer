# CLAUDE.md

This file provides guidance for terminals working in the wireframes folder.

## Terminals Using This Context

- **Generator** - Creates/fixes SVG wireframes
- **Viewer** - Runs hot-reload viewer for preview
- **Reviewer** - Screenshots and documents issues
- **Validator** - Maintains validation script and escalation
- **Inspector** - Cross-SVG consistency checks across all features

## SVG Wireframe Rules

### Canvas & Layout

| Property         | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Canvas           | `viewBox="0 0 1920 1080" width="1920" height="1920"` |
| Desktop mockup   | x=40, y=60, 1280×720                                 |
| Mobile mockup    | x=1360, y=60, 360×720                                |
| Annotation panel | Right side, x=1760+                                  |

### Colors (Light Theme Only)

| Element           | Color     | Notes               |
| ----------------- | --------- | ------------------- |
| Panel backgrounds | `#e8d4b8` | Never use `#ffffff` |
| Toggle OFF        | `#6b7280` | Gray                |
| Toggle ON         | `#22c55e` | Green               |
| Primary buttons   | `#3b82f6` | Blue                |
| Destructive       | `#ef4444` | Red                 |

### Typography

| Element              | Size    | Weight  |
| -------------------- | ------- | ------- |
| Annotation titles    | 16px    | Bold    |
| Annotation narrative | 14px    | Regular |
| UI headings          | 18-24px | Bold    |
| Body text            | 14-16px | Regular |

### Accessibility

- Touch targets: 44px minimum
- Focus indicators: visible on all interactive elements
- Color contrast: WCAG AA compliant

## Validation Workflow

```
Generator creates SVG
       ↓
Validator runs checks (auto)
       ↓
Issues logged to *.issues.md
       ↓
Reviewer classifies (PATCH vs REGEN)
       ↓
Generator fixes based on classification
       ↓
Repeat until PASS
       ↓
Inspector checks cross-SVG consistency
       ↓
Pattern violations logged to *.issues.md
```

## Issue Classification

| Type  | Classification    | Examples                                  |
| ----- | ----------------- | ----------------------------------------- |
| PATCH | Cosmetic fixes    | Wrong color, typo, font size              |
| REGEN | Structural issues | Layout problems, overlapping, positioning |

**Rule**: Never patch structural issues - regenerate instead.

## Issue Escalation Policy

1. **Feature-specific first**: Log to `NNN-feature/*.issues.md`
2. **Escalate after 2+ occurrences**: Pattern seen in multiple features
3. **GENERAL_ISSUES.md**: Only recurring patterns (G-XXX entries)

```bash
# Check for escalation candidates
python validate-wireframe.py --check-escalation
```

## Inspector Checks

The Inspector terminal runs cross-SVG consistency checks after Validator passes:

| Check              | Expected Pattern                       |
| ------------------ | -------------------------------------- |
| Title position     | x=960, y=28 (centered)                 |
| Signature position | y=1060, bold                           |
| Desktop header     | `includes/header-desktop.svg` at y=0   |
| Desktop footer     | `includes/footer-desktop.svg` at y=640 |
| Mobile header      | `includes/header-mobile.svg` at y=0-78 |
| Mobile footer      | `includes/footer-mobile.svg` at y=664  |
| Desktop mockup     | x=40, y=60, 1280×720                   |
| Mobile mockup      | x=1360, y=60, 360×720                  |
| Annotation panel   | x=40, y=800, 1840×220                  |
| Nav active state   | Matches page context                   |

```bash
# Run cross-SVG inspection
python inspect-wireframes.py --all
```

**Classification**: PATTERN_VIOLATION (for Inspector issues)

## Key Files

| File                       | Purpose                            |
| -------------------------- | ---------------------------------- |
| `validate-wireframe.py`    | Automated SVG validation (v5.2)    |
| `inspect-wireframes.py`    | Cross-SVG consistency checker      |
| `screenshot-wireframes.py` | Screenshot tool (6 images per SVG) |
| `GENERAL_ISSUES.md`        | Recurring mistakes catalog         |
| `NNN-feature/*.issues.md`  | Feature-specific issues            |
| `.terminal-status.json`    | Queue and terminal status          |

## Status State Machine

Valid status values and transitions for `.terminal-status.json`:

```
                    ┌───────────────────────────────────────────────────────────┐
                    │                                                           │
                    ▼                                                           │
planning ──► queued ──► generating ──► validating ──► review ──► inspecting ──► approved
                            │              │            │            │
                            │              ▼            │            │
                            │           failed         │            │
                            │              │            │            │
                            └──────────────┴── issues ◄─┴────────────┘
```

| Status       | Description                              | Next States            |
| ------------ | ---------------------------------------- | ---------------------- |
| `planning`   | Planner analyzing spec                   | `queued`               |
| `queued`     | In queue, waiting for Generator          | `generating`           |
| `generating` | Generator actively working               | `validating`, `failed` |
| `validating` | Validator running checks                 | `review`, `issues`     |
| `review`     | Reviewer analyzing screenshots           | `inspecting`, `issues` |
| `inspecting` | Inspector checking cross-SVG consistency | `approved`, `issues`   |
| `issues`     | Problems found, needs regen              | `generating`           |
| `approved`   | Passed all checks                        | (terminal state)       |
| `failed`     | Unrecoverable error                      | (terminal state)       |

**Transition rules:**

- Only Manager can transition `planning` → `queued`
- Only Generator can transition `queued` → `generating`
- Validator auto-transitions `generating` → `validating` → `review` or `issues`
- Reviewer transitions `review` → `inspecting` or `issues`
- Inspector transitions `inspecting` → `approved` or `issues`
- `issues` always goes back to `generating` (via REGEN queue)

## Viewer Shortcuts

| Key            | Action                  |
| -------------- | ----------------------- |
| `←/→`          | Previous/Next wireframe |
| `↑/↓` or `+/-` | Zoom in/out             |
| `0`            | Fit to view             |
| `F`            | Toggle focus mode       |
| `L`            | Toggle legend drawer    |

## Screenshot Output

`png/[feature]/[svg-name]/` contains:

- `overview.png` - Full canvas
- `quadrant-center.png` - Center region
- `quadrant-tl.png`, `quadrant-tr.png`, `quadrant-bl.png`, `quadrant-br.png` - Corners
- `manifest.json` - Paths + validator results
