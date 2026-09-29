---
name: deep-review
description: In-depth code review of the WHOLE repository (not the last commit or current diff). Splits the repo into risk tiers, runs parallel read-only reviewer subagents, and keeps a severity-sorted backlog in docs/review/code-review-backlog.md. Use when asked for a full, whole-repo, or in-depth code review.
---

# Deep review: the whole repository

`/code-review` with no target reviews only the current diff, or the last commit when the tree
is clean. That is the wrong tool for "review the project". This skill reviews everything.
Work through the whole plan without stopping to ask, and report back when the backlog is
complete.

## 1. Size and split the repo

- Read CLAUDE.md and README first, for the architecture and any documented past incidents.
- Count source lines per top-level directory (`git ls-files` + `wc -l` per directory).
- Split into at most 9 review tiers of roughly 10–40k lines each, ordered by risk:
  1. Database, schema and access rules; auth; secrets; anything touching money
  2. Core libraries and services: business logic, data layer, crypto, sync/offline
  3. Hooks, utils, routing and pages (or this stack's equivalent)
  4. Domain-specific subsystems: 3D, games, integrations, workers, etc.
  5. UI components (split in two if large: security-sensitive vs the rest)
  6. `scripts/` and CI workflows: checks that cannot fail, workflow injection, unsafe `rm -rf`
  7. Tests: tests that cannot fail, mocks of the unit under test, fixed waits

## 2. Launch one background reviewer subagent per tier, all in parallel

Give each reviewer the same instructions below, plus priorities specific to its tier:

- READ-ONLY: no edits, no package installs, no state-changing git commands.
- Look for real correctness and security defects, not style.
- VERIFY every candidate. Read the callers, guards, access policies and tests that might
  already prevent it, and drop anything that can't be substantiated. Cap at 15 findings;
  5 solid beats 20 speculative. Group a repeated pattern into one finding with several
  locations.
- Output only findings, each in this shape:

  ```
  ### [P0|P1|P2|P3] <title ≤70 chars>
  - **Where:** `path:line`
  - **Defect:** 1–2 sentences
  - **Failure scenario:** concrete inputs/state → wrong result, leak or crash
  - **Fix:** 1–2 sentences
  - **Confidence:** confirmed | plausible
  ```

  End with a short "checked, no findings" list, so coverage is visible.

- Severity levels:
  - P0: security hole, data loss, auth bypass, money charged or lost
  - P1: user-facing bug on a real path, or a check/test that hides real failure
  - P2: latent bug, edge case, wrong under some configuration
  - P3: minor or robustness issue

## 3. Keep a sorted backlog while the reviewers finish

- Create `docs/review/code-review-backlog.md` with a severity legend, a Summary (counts plus
  cross-cutting themes), a Coverage table (tier → pending/done), then P0 / P1 / P2 / P3
  sections.
- As each reviewer reports, merge its findings into the right section:
  - De-duplicate across reviewers, merging the entries and noting both sources.
  - Re-grade severity where a reviewer under- or over-called it, with a one-line
    "Severity note".
  - Mark the tier done.
- Commit and push the backlog after each batch, to this session's designated branch (never
  the default branch). Never use `--no-verify`; if a hook fails, fix the cause.

## 4. When all tiers are done

- Update the Summary with final counts and the 3–5 themes worth fixing as a class.
- Report the counts, every P0 in one line each, the themes, and the commit.
- Don't open issues or start fixing until the user says which ones.
