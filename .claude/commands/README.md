# Claude Commands (Slash Commands)

## What These Are

These are **instruction files** that tell Claude how to generate artifacts for the spec-kit workflow. They are NOT shell scripts or executables.

## Available Commands

### `/plan`

**File**: `plan.md`
**Purpose**: Generate implementation plan and design artifacts from a spec
**Creates**:

- plan.md (implementation plan)
- research.md (Phase 0)
- data-model.md (Phase 1)
- contracts/ (Phase 1)
- quickstart.md (Phase 1)

**Usage**: After setting up a feature branch with a spec.md, tell Claude: "execute /plan"

### `/tasks`

**File**: `tasks.md`
**Purpose**: Generate actionable task list from plan artifacts
**Creates**:

- tasks.md (numbered tasks following TDD)

**Usage**: After /plan completes, tell Claude: "execute /tasks" or "proceed with /tasks"

### `/specify`

**File**: `specify.md`
**Purpose**: Initialize a spec-kit project (rarely used, project already initialized)

## How They Work

1. These files contain instructions for Claude to follow
2. Claude reads the spec and existing artifacts
3. Claude generates new artifacts based on the instructions
4. No external tools or scripts are required

## Common Misconceptions

❌ **WRONG**: These are shell scripts that need to be executed
✅ **RIGHT**: These are instructions for Claude to follow

❌ **WRONG**: They require setup-plan.sh or other scripts
✅ **RIGHT**: Claude generates everything from the spec

❌ **WRONG**: They use the `uvx specify` tool
✅ **RIGHT**: They work within the existing project structure

## Example Workflow

```bash
# 1. Human creates feature branch
./scripts/prp-to-feature.sh e2e-testing-framework 003

# 2. Human tells Claude
"execute /plan"

# 3. Claude reads plan.md instructions and generates artifacts

# 4. Human tells Claude
"execute /tasks"

# 5. Claude reads tasks.md instructions and generates task list
```

## Important Notes

- The commands are **executed by Claude**, not by shell
- They work by reading and generating markdown files
- No external dependencies beyond the initial project setup
- If scripts are mentioned in the instructions but don't exist, Claude should generate the artifacts directly

---

**Remember**: These are Claude instructions, not executable scripts!
