# CLAUDE.md

## Project Overview

ScriptHammer is a **planning template** for AI-assisted development. It contains 46 feature specifications and an interactive SVG wireframe viewer. No application code exists yet - this is spec-first planning.

## Multi-Terminal Workflow

This project uses 21 Claude Code terminals in a tmux session. Each terminal has a specialized role. See `.claude/roles/` for role-specific context:

| File | Roles |
|------|-------|
| `operator.md` | Operator (runs outside tmux) |
| `council.md` | CTO, Architect, Security, Toolsmith, DevOps, ProductOwner |
| `wireframe-pipeline.md` | Planner, Generators 1-3, PreviewHost, WireframeQA, Validator, Inspector |
| `implementation.md` | Developer, TestEngineer, Auditor |
| `support.md` | Coordinator, Author, QALead, TechWriter |

## Quick Commands

```bash
# Wireframe viewer
cd docs/design/wireframes && npm run dev

# SpecKit workflow
/speckit.specify → /speckit.clarify → /speckit.plan → /speckit.tasks → /speckit.implement

# Utility
/commit          # Lint + commit
/ship            # Commit, merge, cleanup
```

## Project Structure

```
ScriptHammer/
├── features/                    # 46 feature specs
├── docs/design/wireframes/      # SVG wireframes + viewer
├── .claude/roles/               # Role-specific context files
└── .specify/memory/             # Constitution + templates
```

## Key Files

| File | Purpose |
|------|---------|
| `features/IMPLEMENTATION_ORDER.md` | Feature sequence |
| `.specify/memory/constitution.md` | 6 core principles |
| `docs/design/wireframes/.terminal-status.json` | Queue status |

## SVG Rules (Brief)

- Canvas: `viewBox="0 0 1920 1080"`
- Desktop: x=40, y=60, 1280x720 | Mobile: x=1360, y=60, 360x720
- Panel color: `#e8d4b8` (never white)
- Touch targets: 44px minimum

## Persistence Rule

Terminal output is ephemeral. Write findings to: `docs/interoffice/audits/YYYY-MM-DD-[role]-[topic].md`

## Fork Guide

After forking ScriptHammer:

1. **Run `/refresh-inventories`** - Regenerates context files for your specs
2. **Update `.claude/inventories/`** - Reflects your project's features
3. **Modify `features/IMPLEMENTATION_ORDER.md`** - Your dependency sequence

Inventory files are static for performance. Refresh after spec changes.
