---
description: Prepare context for wireframe work (patch or new)
---

Load all context needed before working on wireframes.

## Arguments

```text
$ARGUMENTS
```

- No args: Prep for patching (reads issues)
- Feature number (e.g., `000`): Prep for new/specific feature (reads spec)

## Instructions

### Always do:
1. Read `CLAUDE.md`
2. Read `docs/design/wireframes/GENERAL_ISSUES.md`
3. Read `docs/design/wireframes/wireframe-status.json`

### If no arguments (patching mode):
4. Find and read all `docs/design/wireframes/**/*.issues.md`
5. Output:
   > "Wireframe prep (patch mode): [N] issues files, Status: [counts]. Ready."

### If feature number provided (new/feature mode):
4. Read `features/*/[NNN]-*/spec.md`
5. Read any existing issues for that feature: `docs/design/wireframes/[NNN]-*/*.issues.md`
6. Output:
   > "Wireframe prep ([NNN-name]): [N] FRs, [N] SCs, [N] USs. Ready."

DO NOT summarize content. Keep output to 1-2 lines.
