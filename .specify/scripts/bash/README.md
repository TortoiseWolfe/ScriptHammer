# SpecKit harness scripts

Bash scripts that back the `/speckit.*` slash commands defined in
`.claude/commands/speckit.*.md`. Sourced by Claude Code when running through
the SpecKit cascade defined in `.specify/memory/constitution.md` (v1.0.2,
Principle III).

## Files

| Script                       | Source                | Called by                                                          |
| ---------------------------- | --------------------- | ------------------------------------------------------------------ |
| `check-prerequisites.sh`     | upstream, verbatim    | `/speckit.clarify`, `/speckit.tasks`, `/speckit.implement`, more   |
| `common.sh`                  | upstream + 2 patches  | sourced by all the other scripts                                   |
| `config.sh`                  | ScriptHammer-specific | sourced by `common.sh` (top of file)                               |
| `create-new-feature.sh`      | upstream + 2 patches  | `/speckit.specify`                                                 |
| `setup-plan.sh`              | upstream, verbatim    | `/speckit.plan`                                                    |
| `setup-tasks.sh`             | upstream, verbatim    | (chained workflow; not direct slash command)                       |
| `update-agent-context.sh`    | ScriptHammer stub     | `/speckit.plan` Phase 1 step 3                                     |

Upstream: <https://github.com/github/spec-kit/tree/main/scripts/bash>

## ScriptHammer adaptations

Upstream SpecKit assumes flat `specs/<NNN-name>/` layout. ScriptHammer uses
`features/<category>/<NNN-name>/`. Two functions in `common.sh` were patched:

1. `find_feature_dir_by_prefix()` — recurses through
   `${SPEC_KIT_FEATURES_ROOT}/*/<prefix>-*/` to match the nested layout.
   Returns the absolute path including the `<category>` segment.

2. `get_current_branch()`'s non-git fallback — same recursion change
   when scanning for the latest feature dir.

`create-new-feature.sh` was patched in two places:

1. `SPECS_DIR` resolution honors `SPEC_KIT_FEATURES_ROOT` (default `features`).
2. New feature dirs land under `${SPEC_KIT_FEATURES_ROOT}/${SPEC_KIT_DEFAULT_CATEGORY}/`
   (default `features/_uncategorized/`). Humans triage from there into the right
   category.
3. `get_highest_from_specs()` scans both flat and nested layouts so the
   next-feature-number computation respects both patterns.

`update-agent-context.sh` is a deliberate no-op: ScriptHammer's `CLAUDE.md` is
hand-curated and not auto-rewritten.

## Configuration

Edit `.specify/scripts/bash/config.sh` to override:

- `SPEC_KIT_FEATURES_ROOT` (default `features`)
- `SPEC_KIT_DEFAULT_CATEGORY` (default `_uncategorized`)

Or override per-invocation:
```bash
SPEC_KIT_FEATURES_ROOT=specs ./create-new-feature.sh ...   # acts like upstream
```

## Smoke test

```bash
# From repo root, with no feature branch checked out
SPECIFY_FEATURE=013-oauth-messaging-password \
  .specify/scripts/bash/check-prerequisites.sh --json --paths-only
# Expected: JSON pointing at features/auth-oauth/013-oauth-messaging-password/

.specify/scripts/bash/create-new-feature.sh --dry-run --json \
  --short-name "smoke-test" "Smoke test the harness"
# Expected: JSON with BRANCH_NAME 0XX-smoke-test, SPEC_FILE under _uncategorized/

.specify/scripts/bash/update-agent-context.sh claude
# Expected: stderr "[update-agent-context] No-op for ScriptHammer..."
```

## Updating from upstream

To pull a fresh upstream version (e.g., after a SpecKit release):

```bash
# From a fresh branch
for f in check-prerequisites.sh common.sh create-new-feature.sh setup-plan.sh setup-tasks.sh; do
  curl -sSf "https://raw.githubusercontent.com/github/spec-kit/main/scripts/bash/$f" \
    -o ".specify/scripts/bash/$f"
done
chmod +x .specify/scripts/bash/*.sh
```

Then re-apply the ScriptHammer adaptations listed above. The patches are small
(~50 lines total) and the diffs in git history show what to re-apply.

The `config.sh` and `update-agent-context.sh` files are ScriptHammer-only — never
overwrite them from upstream.
