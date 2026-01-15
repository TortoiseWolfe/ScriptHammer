# GitHub Workflows Status

Generated: 2026-01-15 | Source: `.github/workflows/` | Refresh: `/refresh-inventories`

## Active Workflows

### CI (`ci.yml`)
**Triggers**: Push to main, PRs to main

| Job | Purpose | Status |
|-----|---------|--------|
| `lint` | Pre-commit, ruff | Blocking |
| `validate-wireframes` | SVG validation | Non-blocking (planning phase) |
| `yaml-lint` | YAML linting | Blocking |
| `markdown-lint` | Markdown linting | Blocking |
| `shellcheck` | Shell script checks | Blocking |

**Note**: Wireframe validation runs but uses `continue-on-error: true` during planning phase.

### Pages (`pages.yml`)
**Triggers**: TBD (deployment workflow)

| Job | Purpose |
|-----|---------|
| Deploy | GitHub Pages deployment |

## Missing Workflows (Recommended)

| Workflow | Purpose | Priority |
|----------|---------|----------|
| `test.yml` | Run Vitest, Playwright, Pa11y | High (after code exists) |
| `docker.yml` | Build/push container images | Medium |
| `release.yml` | Semantic versioning, changelog | Low |

## Enforcement Timeline

1. **Planning phase** (current): Validation runs, doesn't block
2. **Transition phase**: Add issue counts to PR comments
3. **Enforcement phase**: Remove `continue-on-error` to block PRs

## Quick Commands

```bash
# Check workflow runs
gh run list --workflow=ci.yml

# View run details
gh run view [run-id]

# Re-run failed
gh run rerun [run-id]
```
