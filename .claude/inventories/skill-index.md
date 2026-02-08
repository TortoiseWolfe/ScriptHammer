# Skill Index

Generated: 2026-01-16 | Refresh: `/refresh-inventories`

## Workflow Skills

| Skill        | Description                                       |
| ------------ | ------------------------------------------------- |
| /commit      | Run linter, type-check, and commit changes        |
| /ship        | Commit, merge to main, clean up branches          |
| /clean-start | Clean build artifacts and restart dev environment |

## SpecKit Skills

| Skill                  | Description                                 |
| ---------------------- | ------------------------------------------- |
| /speckit.specify       | Create/update feature spec from description |
| /speckit.clarify       | Ask clarification questions, encode answers |
| /speckit.plan          | Generate implementation plan                |
| /speckit.checklist     | Generate feature checklist                  |
| /speckit.tasks         | Generate actionable tasks.md                |
| /speckit.implement     | Execute tasks from tasks.md                 |
| /speckit.analyze       | Cross-artifact consistency analysis         |
| /speckit.taskstoissues | Convert tasks to GitHub issues              |
| /speckit.workflow      | Complete workflow with checkpoints          |
| /speckit.constitution  | Create/update project constitution          |

## Wireframe Skills

| Skill                  | Description                          |
| ---------------------- | ------------------------------------ |
| /wireframe             | Generate SVG wireframes (v5)         |
| /wireframe-prep        | Load context before wireframe work   |
| /wireframe-plan        | Plan wireframe assignments (Planner) |
| /wireframe-fix         | Load context for targeted fixes      |
| /wireframe-review      | Review SVGs, classify issues         |
| /wireframe-screenshots | Take standardized screenshots        |
| /wireframe-status      | Update wireframe status JSON         |
| /wireframe-inspect     | Cross-SVG consistency check          |
| /hot-reload-viewer     | Start viewer at localhost:3000       |
| /viewer-status         | Health check for viewer              |

## Council Skills

| Skill      | Description                               |
| ---------- | ----------------------------------------- |
| /rfc       | Create RFC proposal                       |
| /rfc-vote  | Cast vote on RFC                          |
| /vote-now  | Quick RFC voting with consensus detection |
| /council   | Start council discussion                  |
| /broadcast | Announce to all terminals                 |
| /memo      | Send message to manager                   |
| /dispatch  | Send tasks to terminals                   |

## Queue & Status Skills

| Skill         | Description                     |
| ------------- | ------------------------------- |
| /status       | Project health dashboard        |
| /queue        | Task queue management           |
| /queue-check  | Show pending tasks              |
| /review-queue | Show items pending review       |
| /next         | Show next task for role         |
| /log          | Persist findings to central log |

## Testing Skills

| Skill            | Description                            |
| ---------------- | -------------------------------------- |
| /test            | Run comprehensive test suite           |
| /test-components | Run component tests (~5 min)           |
| /test-a11y       | Run Pa11y accessibility tests (~1 min) |
| /test-hooks      | Run hook tests (<1 min)                |
| /test-fail       | Run known failing tests                |

## Analysis Skills

| Skill        | Description                           |
| ------------ | ------------------------------------- |
| /analyze     | Cross-artifact consistency analysis   |
| /clarify     | Ask clarification questions           |
| /read-spec   | Read spec with summary                |
| /read-issues | Read wireframe issues silently        |
| /code-review | Security, performance, quality review |

## Context Skills

| Skill            | Description                   |
| ---------------- | ----------------------------- |
| /prep            | Prepare to discuss repository |
| /prime           | Load role-specific context    |
| /session-summary | Generate continuation prompt  |
| /session-stats   | Show token usage and costs    |

## Utility Skills

| Skill         | Description                  |
| ------------- | ---------------------------- |
| /constitution | Manage project constitution  |
| /specify      | Create/update feature spec   |
| /plan         | Generate implementation plan |
| /implement    | Execute implementation       |
| /tasks        | Generate tasks.md            |

## Automation Scripts (scripts/)

CLI tools for validation, scaffolding, and automation. Run with `python scripts/<name>.py`.

### Validation Scripts

| Script                | Description              | Key Flags                         |
| --------------------- | ------------------------ | --------------------------------- |
| validate-tasks.py     | Task format validation   | `--fix`, `--check-deps`, `--json` |
| validate-contracts.py | Contract validation      | `--json`, `--summary`             |
| validate-wireframe.py | SVG wireframe validation | `--json`, `--report`              |

### Scaffolding Scripts

| Script                | Description                  | Key Flags                       |
| --------------------- | ---------------------------- | ------------------------------- |
| generate-component.py | 5-file Constitution pattern  | `--with-props`, `--dry-run`     |
| generate-ignores.py   | Multi-stack ignore files     | `--detect`, `--verify`, `--all` |
| scaffold-checklist.py | Feature checklist scaffolder | `--dry-run`, `--json`           |
| scaffold-test.py      | Test file scaffolder         | `--dry-run`, `--json`           |

### SpecKit Automation

| Script              | Description             | Key Flags             |
| ------------------- | ----------------------- | --------------------- |
| extract-spec.py     | Spec extraction utility | `--json`, `--summary` |
| fill-plan.py        | Plan template filler    | `--dry-run`, `--json` |
| parse-data-model.py | Data model parser       | `--json`, `--summary` |

### Build & Status Scripts

| Script                 | Description                | Key Flags                             |
| ---------------------- | -------------------------- | ------------------------------------- |
| build-commit.py        | Automated build and commit | `--dry-run`, `--json`                 |
| build-inventory.py     | Spec inventory builder     | `--json`, `--summary`, `--incomplete` |
| project-status.py      | Project health dashboard   | `--json`, `--summary`                 |
| queue-status.py        | Task queue status          | `--json`, `--summary`                 |
| priority-calculator.py | Task priority scoring      | `--json`, `--summary`                 |
| stale-finder.py        | Find stale artifacts       | `--days`, `--json`                    |

### Wireframe Scripts

| Script                 | Description                  | Key Flags           |
| ---------------------- | ---------------------------- | ------------------- |
| inspect-wireframes.py  | Cross-SVG consistency        | `--all`, `--report` |
| dispatch-precompute.py | Precompute wireframe context | `--json`            |

### Council & Comms Scripts

| Script              | Description               | Key Flags             |
| ------------------- | ------------------------- | --------------------- |
| council-agenda.py   | Generate council agenda   | `--json`, `--summary` |
| memo-router.py      | Route memos to recipients | `--json`              |
| broadcast-sender.py | Send broadcasts           | `--dry-run`, `--json` |
| escalation-check.py | Check escalation status   | `--json`, `--summary` |

### Analysis Scripts

| Script                | Description              | Key Flags             |
| --------------------- | ------------------------ | --------------------- |
| constitution-check.py | Constitution compliance  | `--json`, `--summary` |
| dependency-graph.py   | Feature dependency graph | `--json`, `--dot`     |
| feature-context.py    | Feature context loader   | `--json`, `--summary` |
| audit-template.py     | Audit report generator   | `--json`, `--summary` |
| completion-log.py     | Completion tracking      | `--json`, `--summary` |
