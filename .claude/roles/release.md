# Release Terminal Context

**Release roles** (assembly line order):

| Role           | Domain                           | Reports To |
| -------------- | -------------------------------- | ---------- |
| DevOps         | CI/CD, pipelines, deployment     | CTO        |
| DockerCaptain  | Container health, infrastructure | DevOps     |
| ReleaseManager | Version coordination, changelogs | DevOps     |

## Role Responsibilities

### DevOps

CI/CD pipelines, deployment workflows, and release automation.

**Key Files:**

- `.github/workflows/` - GitHub Actions
- `docker-compose.yml` - Service definitions
- `.claude/knowledge/docker/` - Docker best practices

**Skills:**
| Skill | Purpose |
|-------|---------|
| `/status` | Project health dashboard |
| `/clean-start` | Reset dev environment |

**Note:** DevOps also participates in Council for architectural decisions. See `council.md`.

### DockerCaptain

Container management and infrastructure monitoring.

**Full context:** See `.claude/roles/docker-captain.md`

**Quick reference:**

- Monitor scripthammer health
- Check container logs for errors
- Run CVE scans with `docker scout`
- Restart stuck services

### ReleaseManager

Version coordination, changelog maintenance, and release notes.

**Skills:**
| Skill | Purpose |
|-------|---------|
| `/release-prep` | Pre-release checklist |
| `/changelog-update` | Update `docs/project/CHANGELOG.md` |
| `/release-notes` | Generate release notes |
| `/commit` | Lint + commit changes |
| `/ship` | Commit, merge, cleanup |

**Responsibilities:**

1. **Version Coordination** - Semantic versioning decisions
2. **Changelog Maintenance** - Keep `docs/project/CHANGELOG.md` current
3. **Release Notes** - Summarize changes for users
4. **Tag Management** - Coordinate git tags with DevOps
5. **Release Checklist** - Verify all pre-release criteria met

## Release Workflow

```
Development → Release Prep → Changelog → Tag → Deploy
     ↓              ↓            ↓         ↓       ↓
  DevOps      ReleaseManager  Author   DevOps  DockerCaptain
```

### Which changelog

**`docs/project/CHANGELOG.md`, and there is only one.** This used to be ambiguous: a second
`CHANGELOG.md` sat at the repo root with different content and a contradictory history — it
dated 0.1.0 to 2026-01-13 while the canonical file dated it 2025-09-14 — and every reference
in this file said "CHANGELOG.md" unqualified. Whichever an agent opened first won, which is a
coin flip in a release process (#569).

The root file was not a stale copy. It was the **planning-factory / wireframe-pipeline**
changelog — SpecKit, tmux roles, RFCs, validator rules — a different subsystem with its own
history, which is why merging it into a semver changelog would have been wrong. It now lives
at `docs/project/PLANNING-FACTORY-CHANGELOG.md` as an archive of a retired pipeline, and
`scripts/__tests__/single-changelog.test.js` fails if a root `CHANGELOG.md` reappears.

### Pre-Release Checklist

- [ ] All tests passing
- [ ] `docs/project/CHANGELOG.md` updated (the ONLY changelog — see below)
- [ ] Version bumped appropriately
- [ ] No uncommitted changes
- [ ] Docker images built and scanned
- [ ] Release notes drafted

### Changelog Format

Follow Keep a Changelog (keepachangelog.com):

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- New features

### Changed

- Changes in existing functionality

### Fixed

- Bug fixes

### Removed

- Removed features
```

## Communication

ReleaseManager coordinates with:

- **DevOps** - Pipeline status, deployment readiness
- **DockerCaptain** - Container health, image builds
- **Author** - Release notes content
- **Coordinator** - Queue status, blocking issues

Use `/memo devops [subject]` for release coordination.

## Persistence Rule

Write findings to: `docs/interoffice/audits/YYYY-MM-DD-[role]-[topic].md`

Never just print - terminal output is ephemeral.
