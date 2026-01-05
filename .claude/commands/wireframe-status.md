---
description: Update wireframe status with interactive menu (modifies wireframe-status.json)
---

Update the status of wireframes in the central tracker.

## Single Source of Truth

**File:** `docs/design/wireframes/wireframe-status.json`

The viewer dynamically loads status from this JSON file. Updates here are reflected in:
- Wireframe viewer sidebar (feature and SVG badges)
- Any other tools that read the JSON

## Arguments

```text
$ARGUMENTS
```

- `FEATURE` - Feature number (e.g., `000`, `001`) or feature name
- `FEATURE:SVG` - Specific SVG (e.g., `000:01` for first SVG)
- If empty, shows status summary of all features

## Status Values

| # | Key | Emoji | Meaning |
|---|-----|-------|---------|
| 1 | draft | 📝 | Initial `/wireframe` generation |
| 2 | regenerating | 🔄 | Being regenerated after issues |
| 3 | review | 👁️ | Under `/wireframe-review` |
| 4 | issues | 🔴 | Review found problems (needs regenerate) |
| 5 | patchable | 🟡 | Minor fixes only |
| 6 | approved | ✅ | Passed review |
| 7 | planning | 📋 | In `/speckit.plan` phase |
| 8 | tasked | 📝 | Has `tasks.md` |
| 9 | inprogress | 🚧 | `/speckit.implement` started |
| 10 | complete | ✅ | Implementation done |
| 11 | blocked | ⛔ | Waiting on dependency |

## Process

### 1. Read Current Status

```bash
# Read the JSON file
cat docs/design/wireframes/wireframe-status.json
```

If no arguments, show status summary table of all features.

If feature number provided:
1. Find feature in JSON (e.g., `000-rls-implementation`)
2. Show current status
3. Present menu using `AskUserQuestion`

### 2. Present Menu

Use `AskUserQuestion` tool to present status options:

```
Current: 000-rls-implementation → draft (📝)

Select new status:
```

Options (use key names in JSON):
- draft (📝)
- regenerating (🔄)
- review (👁️)
- issues (🔴)
- patchable (🟡)
- approved (✅)
- planning (📋)
- tasked (📝)
- inprogress (🚧)
- complete (✅)
- blocked (⛔)

### 3. Update wireframe-status.json

1. Read `docs/design/wireframes/wireframe-status.json`
2. Find the feature object
3. Update `status` field (and optionally SVG statuses)
4. Write updated JSON file

**Before:**
```json
{
  "000-rls-implementation": {
    "status": "draft",
    "svgs": {
      "01-rls-overview.svg": "draft",
      "02-rls-requirements.svg": "draft"
    }
  }
}
```

**After (feature-level update):**
```json
{
  "000-rls-implementation": {
    "status": "approved",
    "svgs": {
      "01-rls-overview.svg": "approved",
      "02-rls-requirements.svg": "approved"
    }
  }
}
```

### 4. Report

Output summary of changes:
```
Updated 000-rls-implementation: draft → approved
- Feature status: approved
- 2 SVGs updated to approved
```

## Per-SVG Status

For granular SVG updates:

```bash
/wireframe-status 000:01
```

This updates only `01-*.svg` status within the feature, leaving feature status unchanged.

## Automation Note

This skill is for **manual overrides**. Status is normally auto-updated by:
- `/wireframe` → draft or regenerating
- `/wireframe-review` → review, issues, patchable, or approved
- `/speckit.plan` → planning
- `/speckit.tasks` → tasked
- `/speckit.implement` → inprogress or complete
