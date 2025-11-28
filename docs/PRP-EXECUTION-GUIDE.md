# PRP Execution Guide - Stop Arguing, Start Executing

## ⚡ Quick Command Reference

```bash
# Step 1: Setup feature branch from PRP
./scripts/prp-to-feature.sh <prp-name> <number>

# Step 2: Execute /plan command (creates plan.md + Phase 0/1 artifacts)
# Just tell Claude: "execute /plan"

# Step 3: Execute /tasks command (creates tasks.md)
# Just tell Claude: "execute /tasks" or "proceed with /tasks"

# That's it. Stop. Don't overthink it.
```

## 🚨 IMPORTANT: What These Commands Actually Do

### The `/plan` Command

**What it does**: Generates implementation plan and design artifacts
**What it creates**:

- `plan.md` - Implementation plan with constitution checks
- `research.md` - Phase 0 research and analysis
- `data-model.md` - Phase 1 data models
- `contracts/` - Phase 1 API contracts
- `quickstart.md` - Phase 1 quick start guide

**What it DOESN'T do**:

- It does NOT run shell scripts that don't exist
- It does NOT need setup-plan.sh (that's not implemented)
- It does NOT use `uvx specify` commands
- Claude just reads the spec and generates the artifacts

### The `/tasks` Command

**What it does**: Generates actionable task list from plan artifacts
**What it creates**:

- `tasks.md` - Numbered tasks (T001, T002, etc.) following TDD

**What it DOESN'T do**:

- It does NOT need check-task-prerequisites.sh
- It does NOT use external tools
- Claude just reads the plan artifacts and generates tasks

## 📋 Complete Workflow Example

### Example: PRP 003 - E2E Testing Framework

```bash
# 1. Create feature branch
./scripts/prp-to-feature.sh e2e-testing-framework 003
# Output: Creates branch 003-e2e-testing-framework
#         Copies PRP to docs/specs/003-e2e-testing-framework/spec.md

# 2. Tell Claude to execute plan
You: "execute /plan"
# Claude creates: plan.md, research.md, data-model.md, contracts/, quickstart.md

# 3. Tell Claude to execute tasks
You: "proceed with /tasks"
# Claude creates: tasks.md with 25 tasks

# Done! Ready for implementation
```

## ❌ Common Mistakes (Don't Do These)

### Mistake 1: Looking for Scripts That Don't Exist

```bash
# WRONG - These don't exist:
.specify/scripts/bash/setup-plan.sh
.specify/scripts/bash/check-task-prerequisites.sh

# RIGHT - The commands are Claude instructions, not shell scripts
```

### Mistake 2: Trying to Use Specify Tool

```bash
# WRONG - Specify is just for initialization:
uvx specify generate plan
uvx specify generate tasks

# RIGHT - Just tell Claude to execute the commands:
"execute /plan"
"execute /tasks"
```

### Mistake 3: Creating Files Manually

```bash
# WRONG - Don't create these yourself:
touch plan.md
vim tasks.md

# RIGHT - Let Claude generate them from the spec:
"execute /plan"  # Claude creates all Phase 0/1 files
"execute /tasks" # Claude creates tasks.md
```

## 🎯 The Actual Implementation

The `/plan` and `/tasks` commands are **Claude instructions** documented in:

- `.claude/commands/plan.md` - Instructions for generating plan
- `.claude/commands/tasks.md` - Instructions for generating tasks

These are NOT shell scripts. They're instructions that tell Claude what artifacts to generate based on the spec.

## ✅ Verification Checklist

After running the workflow, you should have:

```
docs/specs/<number>-<feature-name>/
├── spec.md           # From PRP (copied by prp-to-feature.sh)
├── plan.md           # From /plan command
├── research.md       # From /plan command
├── data-model.md     # From /plan command
├── quickstart.md     # From /plan command
├── contracts/        # From /plan command
│   └── *.yaml/json   # API contracts
└── tasks.md          # From /tasks command
```

## 🔄 Repeatable Process

For ANY new PRP:

1. **Find the PRP**: `ls docs/prp-docs/*-prp.md`
2. **Create branch**: `./scripts/prp-to-feature.sh <name> <number>`
3. **Execute plan**: Tell Claude "execute /plan"
4. **Execute tasks**: Tell Claude "execute /tasks"
5. **Start coding**: Follow tasks.md in order

## 📝 Notes for Future PRPs

- The process is the SAME for every PRP
- The commands work by having Claude read specs and generate artifacts
- No external tools needed beyond the initial branch setup script
- If Claude starts looking for non-existent scripts, show them this guide

## 🚀 Quick Start for Next PRP

```bash
# For PRP 004 (WCAG AA Compliance):
./scripts/prp-to-feature.sh wcag-compliance 004
# Tell Claude: "execute /plan"
# Tell Claude: "execute /tasks"
# Start implementing T001

# For PRP 005 (Colorblind Mode):
./scripts/prp-to-feature.sh colorblind-mode 005
# Tell Claude: "execute /plan"
# Tell Claude: "execute /tasks"
# Start implementing T001
```

---

**Remember**: The slash commands are Claude instructions, not shell scripts. Stop looking for scripts that don't exist. Just tell Claude to execute the commands and it will generate the appropriate artifacts based on the spec.

**Last Updated**: 2025-09-14
**Tested With**: PRP 003 (E2E Testing Framework)
