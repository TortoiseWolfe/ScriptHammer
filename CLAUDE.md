# CLAUDE.md

## Project Overview

ScriptHammer is a **planning template** for AI-assisted development. It contains 46 feature specifications and an interactive SVG wireframe viewer. No application code exists yet - this is spec-first planning.

## Multi-Terminal Workflow

This project uses 26 Claude Code terminals in a tmux session arranged in **assembly line order**:

```
STRATEGY:    CTO → ProductOwner → BusinessAnalyst
DESIGN:      Architect → UXDesigner → UIDesigner
WIREFRAMES:  Planner → Generators 1-3 → PreviewHost → WireframeQA → Validator → Inspector
CODE:        Developer → Toolsmith → Security
TEST:        TestEngineer → QALead → Auditor
DOCS:        Author → TechWriter
RELEASE:     DevOps → DockerCaptain → ReleaseManager → Coordinator
```

See `.claude/roles/` for role-specific context:

| File | Roles |
|------|-------|
| `operator.md` | Operator (runs outside tmux) |
| `council.md` | CTO, ProductOwner, Architect, UXDesigner, Toolsmith, Security, DevOps |
| `design.md` | UIDesigner |
| `wireframe-pipeline.md` | Planner, Generators 1-3, PreviewHost, WireframeQA, Validator, Inspector |
| `implementation.md` | Developer, TestEngineer, QALead, Auditor |
| `support.md` | Author, TechWriter, BusinessAnalyst, Coordinator |
| `release.md` | DevOps, DockerCaptain, ReleaseManager |
| `stw-liaison.md` | StW-Liaison (client operator for SpokeToWork) |

### Client Liaisons

For external client projects, specialized **Liaison Operators** manage separate tmux sessions:

| Client | Code | Liaison | Session | Script |
|--------|------|---------|---------|--------|
| SpokeToWork | StW | StW-Liaison | `stw` | `./scripts/client-session.sh --client stw --all` |

Client Liaisons run outside their session (like the main Operator) and coordinate with Council for decisions.

**CRITICAL**: Terminals MUST use `--dangerously-skip-permissions` for autonomous operation.
Without this flag, every edit/commit/bash blocks waiting for manual approval.
See `scripts/AUTOMATION.md` for details.

## Git Rules

### TERMINALS: COMMIT ONLY - NEVER PUSH

**Pushing is NOT your job.** Only the Operator (turtle_wolfe) has SSH access to push.

| Action | Allowed? |
|--------|----------|
| `git add` | YES |
| `git commit` | YES |
| `git push` | **NO - NEVER** |
| `git push origin` | **NO - NEVER** |
| Asking to push | **NO - NEVER** |

**Stay in your lane.** Commit your work and move on. The Operator handles all pushes.

**NEVER change the git remote URL.** It MUST remain SSH:
```
origin  git@github.com:TortoiseWolfe/ScriptHammer.git
```

If you see HTTPS (`https://github.com/...`), fix it immediately:
```bash
git remote set-url origin git@github.com:TortoiseWolfe/ScriptHammer.git
```

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
