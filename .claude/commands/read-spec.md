---
description: Read a feature spec with concise summary
---

Read a feature's spec.md and output a brief confirmation.

## Arguments

```text
$ARGUMENTS
```

- Feature number (e.g., `000`, `001`, `002`)
- Or feature name (e.g., `rls-implementation`)

## Instructions

1. **Find the feature spec**:
   - Pattern: `features/*/[NNN]-*/spec.md`

2. **Read the spec.md file**

3. **Output concise summary**:
   > "Read [NNN-feature-name]: [N] FRs, [N] SCs, [N] USs. Ready."

DO NOT summarize content, list requirements, or create tables. Keep output to 1 line.
