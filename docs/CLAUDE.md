# CLAUDE.md

This file provides guidance for the Author terminal working in the docs folder.

## Terminal Using This Context

- **Author** - Blog posts, social media, release notes, workflow documentation

## Documentation Standards

### Tone & Voice

- Clear, concise, technical
- Active voice preferred
- No unnecessary jargon
- Explain acronyms on first use

### Structure

- Start with purpose/summary
- Use tables for comparisons
- Code blocks for commands
- Bullet points for lists

### File Naming

- Lowercase with hyphens: `workflow-guide.md`
- Prefix with date for posts: `2026-01-13-feature-release.md`
- Use `.md` extension for all docs

## Content Types

### Blog Posts

- 500-1000 words
- Include code examples where relevant
- Add "TL;DR" summary at top
- End with call-to-action or next steps

### Release Notes

```markdown
## v1.2.0 (2026-01-13)

### Added

- Feature description

### Changed

- What changed and why

### Fixed

- Bug that was fixed

### Removed

- What was removed (if any)
```

### Workflow Documentation

- Step-by-step with numbered lists
- Include prerequisites
- Add troubleshooting section
- Link to related docs

## Key Files

| File                 | Purpose                       |
| -------------------- | ----------------------------- |
| `design/wireframes/` | SVG wireframes and viewer     |
| `README.md`          | Project overview (root level) |
| `CHANGELOG.md`       | Version history               |

## Skills

- `/session-summary` - Generate continuation prompt
- `/changelog` - Update changelog with recent changes
