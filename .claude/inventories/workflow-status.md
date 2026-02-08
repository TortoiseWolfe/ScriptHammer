# GitHub Workflows Status

Generated: 2026-01-15 | Source: `.github/workflows/` | Refresh: `/refresh-inventories`

## Active Workflows

### CI (`ci.yml`)

**Triggers**: Push to main, PRs to main

| Job                   | Purpose                      | Status                        |
| --------------------- | ---------------------------- | ----------------------------- |
| `lint`                | Pre-commit, ruff             | Blocking                      |
| `validate-wireframes` | SVG validation + PR comments | Non-blocking (Phase 2 active) |
| `yaml-lint`           | YAML linting                 | Blocking                      |
| `markdown-lint`       | Markdown linting             | Blocking                      |
| `shellcheck`          | Shell script checks          | Blocking                      |

**Note**: Wireframe validation uses `continue-on-error: true` but now posts issue counts to PR comments (Phase 2 active per RFC-004).

## Wireframe Validation Status (RFC-004)

| Metric        | Current     | Phase 2 Target | Phase 3 Target |
| ------------- | ----------- | -------------- | -------------- |
| SVG Count     | 35          | ≥ 40           | ≥ 40           |
| Pass Rate     | 100%        | ≥ 80%          | 100%           |
| Open Issues   | 0           | < 50           | 0              |
| Current Phase | **Phase 2** | -              | -              |

**Phase 2 Exit Criteria**:

- [x] Pass rate 100%
- [x] Issue backlog 0
- [ ] CTO sign-off on enforcement
- [ ] Implementation phase begins (`src/` folder created)

### Pages (`pages.yml`)

**Triggers**: TBD (deployment workflow)

| Job    | Purpose                 |
| ------ | ----------------------- |
| Deploy | GitHub Pages deployment |

## Missing Workflows (Recommended)

| Workflow      | Purpose                        | Priority                 |
| ------------- | ------------------------------ | ------------------------ |
| `test.yml`    | Run Vitest, Playwright, Pa11y  | High (after code exists) |
| `docker.yml`  | Build/push container images    | Medium                   |
| `release.yml` | Semantic versioning, changelog | Low                      |

## Enforcement Timeline (RFC-004)

1. **Phase 1 - Planning**: ~~Validation runs, doesn't block~~ ✓ Complete
2. **Phase 2 - Transition** (current): PR comments enabled, non-blocking
3. **Phase 3 - Enforcement**: Remove `continue-on-error` to block PRs

## Quick Commands

```bash
# Check workflow runs
gh run list --workflow=ci.yml

# View run details
gh run view [run-id]

# Re-run failed
gh run rerun [run-id]
```
