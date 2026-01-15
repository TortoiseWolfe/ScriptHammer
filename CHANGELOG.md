# Changelog

All notable changes to ScriptHammer are documented here.

## [Unreleased] - 2026-01-15

### Added
- **Role-based context system**: 21 specialized terminal roles with focused context files (`.claude/roles/`)
- **Docker Captain role**: New terminal role with Brett Fisher's Docker knowledge base
- **Central logging system**: Persistence rules ensuring terminal output survives sessions
- **RFC-004**: CI wireframe validation enforcement workflow
- **13 new feature wireframes**: 34+ SVGs added for features 003-015
- **Product Owner role**: New council member with `/status` skill and audit oversight
- **Tmux session launcher**: Script for multi-terminal workflow automation (`scripts/launch-session.sh`)
- **Python automation scripts**: Token-efficient wireframe processing tools
- **PNG collection script**: Automated overview screenshot gathering
- **Validator output flags**: `--json` and `--summary` flags for CI integration (41d5c4d)
- **P0 pre-implementation docs**: Documentation for priority-zero features (69f767a)
- **Constitution v1.1.0**: Updated constitution via RFC-005 approval

### Changed
- **Automation workflow**: Now requires `--dangerously-skip-permissions` flag for autonomous operation
- **Terminal role hierarchy**: Restructured with CTO at top of reporting chain
- **Wireframe title positions**: Corrected x=700→x=960 across 21 SVGs for consistency
- **Docker viewer base image**: Upgraded to `node:22-bookworm-slim` for CVE reduction (63827d1)

### Fixed
- **Inspector title detection**: Rewritten to handle multiline SVG `<title>` elements
- **Wireframe viewer navigation**: Fixed routing and screenshot size bugs
- **Dark theme**: Corrected color scheme in wireframe viewer
- **CI validator parsing**: Use `--json` output instead of grep parsing (37e387a)
- **Docker health check**: Alpine compatibility fix for viewer container (d4a37aa)
- **SVG position issues**: Patched Inspector-identified positioning problems (5410509)

### Removed
- **Stale issue files**: Cleaned up 11 obsolete wireframe issue files (4d40e54)

### Decisions
- **RFC-004 approved**: Unanimous 6-0 council vote for CI wireframe validation enforcement
- **RFC-005 approved**: Unanimous council vote for constitution v1.1.0 amendments (696ef23)

---

## [0.1.0] - 2026-01-13

### Added
- Initial feature specifications (46 features)
- Interactive SVG wireframe viewer
- SpecKit workflow integration
- Multi-terminal tmux architecture
- Queue-based task management system

---

*Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)*
