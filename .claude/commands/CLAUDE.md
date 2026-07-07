# CLAUDE.md

This file provides guidance for the Toolsmith terminal working with skill files.

## Terminal Using This Context

- **Toolsmith** - Maintain skill files, refactor tools, optimize validator

## Skill Locations

| Location                   | Scope    | Contains                                  |
| -------------------------- | -------- | ----------------------------------------- |
| `~/.claude/commands/`      | Personal | wireframe.md, prep.md, commit.md, ship.md |
| `.claude/commands/` (repo) | Project  | speckit.\*.md skills                      |

## Skill File Structure

```markdown
---
description: Short description shown in skill list
scope: personal | project
---

Instructions for Claude to follow.

## Sections

Use markdown headers to organize.

## Arguments

Document any arguments: `/skill [arg1] [arg2]`
```

## Conventions

### Naming

- Lowercase with hyphens: `wireframe-prep.md`
- Prefix namespaced: `speckit.analyze.md`
- Keep names short and descriptive

### Structure

1. **Frontmatter** - description, scope
2. **Purpose** - What this skill does
3. **Instructions** - Step-by-step for Claude
4. **Arguments** - Document any inputs
5. **Examples** - Show usage

### Output Rules

- Keep output concise
- Use "Ready." confirmations for silent operations
- Don't summarize unless asked
- Respect user's context awareness

## Testing Skills

1. Read the skill file
2. Run the skill with test arguments
3. Verify output matches intent
4. Check edge cases (no args, invalid args)

## Refactoring Guidelines

### When to Split

- Skill > 200 lines
- Multiple distinct functions
- Shared components between skills

### When to Merge

- Two skills always run together
- Significant overlap in logic

## Validator Integration

The `validate-wireframe.py` script is shared with Validator terminal:

- **Validator** adds new `_check_*()` methods
- **Toolsmith** refactors and optimizes

## Key Files

| File                                   | Purpose                 |
| -------------------------------------- | ----------------------- |
| `~/.claude/commands/wireframe.md`      | SVG generation (v5)     |
| `~/.claude/commands/wireframe-prep.md` | Context priming         |
| `~/.claude/commands/prep.md`           | General project prep    |
| `.claude/commands/speckit.*.md`        | SpecKit workflow skills |
