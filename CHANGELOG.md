# Changelog

All notable changes to ScriptHammer are documented here.

## [Unreleased] - 2026-01-16

### Added

- **SpecKit constitution check**: Analyze workflow now validates constitution compliance (2f85f07)
- **QC-Operator role**: PNG batch quality control workflow for wireframe review (7d99622)
- **Tmux QC flag**: `--qc` option for Quality Control session layout (37d1aa7)
- **Inspector active state checks**: G-045/G-046 mobile navigation validation (2ff3628)
- **Signature validation**: Inspector checks for signature alignment and format (9fe9f5e)
- **Validator SIGNATURE checks**: SIGNATURE-003/004 rules for left-alignment and format (1509660, 92367fb)
- **XML syntax rules**: G-040, G-041, G-042 documentation for SVG compliance (a0fb2a9)
- **Auth feature contracts**: 003-auth quickstart and test plan documentation (4aaaef8)
- **Auditor guidance report**: Gap analysis for validator rule coverage (e012272)
- **Script caching system**: Token-efficient precompute for wireframe processing (ea0b41f)
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

- **Role boundaries**: Explicit wireframe-pipeline role boundaries documented (ff04984)
- **Operator rules**: Explicit instruction-only execution and tmux send-keys requirements (13f7720, e5741d7)
- **Window references**: Documentation updated to use window names not numbers (be2ad62)
- **Automation workflow**: Now requires `--dangerously-skip-permissions` flag for autonomous operation
- **Terminal role hierarchy**: Restructured with CTO at top of reporting chain
- **Wireframe title positions**: Corrected x=700→x=960 across 21 SVGs for consistency
- **Docker viewer base image**: Upgraded to `node:22-bookworm-slim` for CVE reduction (63827d1)

### Fixed

- **G-047 Key Concepts position**: Corrected y=730→y=940 with Architect confirmation (ce349fd, 61787fa)
- **Validator ANN-004**: Handle malformed SVG gracefully (965e7d3)
- **Batch wireframe patches**: G-044, G-047, SIGNATURE-003 fixes applied (46eb178)
- **Dispatch targeting**: Use window names instead of numbers (1963190)
- **QC-Operator README**: Format consistency with other role documentation (f6182bc)
- **Inspector title detection**: Rewritten to handle multiline SVG `<title>` elements
- **Wireframe viewer navigation**: Fixed routing and screenshot size bugs
- **Dark theme**: Corrected color scheme in wireframe viewer
- **CI validator parsing**: Use `--json` output instead of grep parsing (37e387a)
- **Docker health check**: Alpine compatibility fix for viewer container (d4a37aa)
- **SVG position issues**: Patched Inspector-identified positioning problems (5410509)

### Removed

- **Stale issue files**: Cleaned up 11 obsolete wireframe issue files (4d40e54)
- **Premature files**: Session cleanup removed files created before specs (2e1e664)

### Decisions

- **RFC-004 approved**: Unanimous 6-0 council vote for CI wireframe validation enforcement
- **RFC-005 approved**: Unanimous council vote for constitution v1.1.0 amendments (696ef23)

### Audits

- **Validator full sweep**: 27/45 wireframes pass, 18 require fixes (43a6417)
- **G-039 nav analysis**: Active state check classification (6447289)
- **G-044 PATCH classification**: Line-number based issue tracking (2dcc818)
- **Inspector verification**: Toolsmith task audit completed (8c6cea8)

---

## [0.1.0] - 2026-01-13

### Added

- Initial feature specifications (46 features)
- Interactive SVG wireframe viewer
- SpecKit workflow integration
- Multi-terminal tmux architecture
- Queue-based task management system

---

_Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)_
