# Technical Debt: Docker-First Violation

**Created**: 2026-01-16
**Severity**: HIGH
**Owner**: Toolsmith (introduced), DevOps (remediation)
**Constitution Reference**: Principle IV - Docker-First Development

---

## Issue Summary

Root `package.json` was created that assumes local `npm`/`python3` installed on host machine. This violates the Docker-first constitution principle.

## Affected File

```
/package.json (untracked)
```

## Constitution Violation

**Principle IV: Docker-First Development**

> No local installs, all via Docker

The created `package.json` contains scripts like:

```json
{
  "scripts": {
    "generate:component": "python3 scripts/generate-component.py",
    "validate:wireframe": "python3 scripts/validate-wireframe.py"
  }
}
```

These assume:

- `python3` available on host
- Direct execution outside containers
- Local development environment setup

## Anti-Patterns Introduced

| Script                        | Violation                          |
| ----------------------------- | ---------------------------------- |
| `pnpm run generate:component` | Invokes `python3` directly on host |
| `pnpm run validate:wireframe` | Invokes `python3` directly on host |
| `pnpm run validate:tasks`     | Invokes `python3` directly on host |
| `pnpm run validate:contracts` | Invokes `python3` directly on host |
| `pnpm run inspect:wireframes` | Invokes `python3` directly on host |
| `pnpm run status`             | Invokes `python3` directly on host |
| `pnpm run queue`              | Invokes `python3` directly on host |

## Recommended Remediation

### Option A: Delete and Use Makefile (Preferred)

1. Delete `/package.json`
2. Create `/Makefile` with Docker-wrapped commands:

```makefile
.PHONY: generate-component validate-wireframe

DOCKER_RUN = docker compose run --rm speckit

generate-component:
	$(DOCKER_RUN) python3 scripts/generate-component.py $(ARGS)

validate-wireframe:
	$(DOCKER_RUN) python3 scripts/validate-wireframe.py $(ARGS)

# Usage: make generate-component ARGS="Button --path src/components"
```

### Option B: Docker Compose Scripts

Create convenience scripts in `scripts/docker/`:

```bash
#!/bin/bash
# scripts/docker/generate-component.sh
docker compose run --rm speckit python3 scripts/generate-component.py "$@"
```

### Option C: Keep package.json but Fix Scripts

If package.json needed for other reasons, fix scripts to use Docker:

```json
{
  "scripts": {
    "generate:component": "docker compose run --rm speckit python3 scripts/generate-component.py"
  }
}
```

## Action Items

| #   | Action                                    | Owner     | Priority |
| --- | ----------------------------------------- | --------- | -------- |
| 1   | Delete `/package.json`                    | Toolsmith | HIGH     |
| 2   | Create Makefile or docker wrapper scripts | DevOps    | HIGH     |
| 3   | Update Action #10 in action-plan.md       | Toolsmith | MEDIUM   |
| 4   | Document Docker-first in onboarding       | Author    | LOW      |

## Terminal Guidance

**All code-writing terminals must understand:**

- No local package installs (`npm install`, `pip install`, etc.)
- All commands run inside Docker containers
- Use `docker compose run` for one-off commands
- Use `docker compose exec` for running containers
- Constitution Principle IV is non-negotiable

## Root Cause

Action #10 ("Add pnpm wrapper for generate-component.py") was interpreted as requiring a traditional npm script approach. The Docker-first constraint was not considered during implementation.

## Prevention

- Add Docker-first check to `/commit` skill (lint step)
- Flag any `package.json` scripts that invoke local binaries
- Add constitution reminder to Toolsmith role context

---

## Resolution Status

| Date       | Action                      | By       |
| ---------- | --------------------------- | -------- |
| 2026-01-16 | Issue identified and logged | Operator |
| -          | Awaiting remediation        | -        |
