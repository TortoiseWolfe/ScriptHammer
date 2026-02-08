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

- Monitor wireframe-viewer health
- Check container logs for errors
- Run CVE scans with `docker scout`
- Restart stuck services

### ReleaseManager

Version coordination, changelog maintenance, and release notes.

**Skills:**
| Skill | Purpose |
|-------|---------|
| `/release-prep` | Pre-release checklist |
| `/changelog-update` | Update CHANGELOG.md |
| `/release-notes` | Generate release notes |
| `/commit` | Lint + commit changes |
| `/ship` | Commit, merge, cleanup |

**Responsibilities:**

1. **Version Coordination** - Semantic versioning decisions
2. **Changelog Maintenance** - Keep CHANGELOG.md current
3. **Release Notes** - Summarize changes for users
4. **Tag Management** - Coordinate git tags with DevOps
5. **Release Checklist** - Verify all pre-release criteria met

## Release Workflow

```
Development → Release Prep → Changelog → Tag → Deploy
     ↓              ↓            ↓         ↓       ↓
  DevOps      ReleaseManager  Author   DevOps  DockerCaptain
```

### Pre-Release Checklist

- [ ] All tests passing
- [ ] CHANGELOG.md updated
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
