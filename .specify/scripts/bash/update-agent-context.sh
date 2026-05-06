#!/usr/bin/env bash
# update-agent-context.sh — referenced by /speckit.plan but absent from upstream
# github/spec-kit. ScriptHammer's stance: CLAUDE.md is hand-curated, not auto-rewritten.
#
# This script intentionally NO-OPs. Future enhancement could append per-feature
# tech-stack notes to a dedicated `.specify/agent-context/<feature>.md` file
# (NOT the repo CLAUDE.md), but for now we just acknowledge the call so /speckit.plan
# doesn't error out.
#
# Usage:
#   update-agent-context.sh <agent-name>     # Currently only "claude" is supported
#   update-agent-context.sh --help

set -euo pipefail

AGENT_NAME="${1:-claude}"

case "$AGENT_NAME" in
    --help|-h)
        cat <<'EOF'
Usage: update-agent-context.sh [agent-name]

Updates agent-specific context file with new tech-stack details from current plan.md.

ScriptHammer behavior: NO-OP. CLAUDE.md is hand-curated and not auto-rewritten.
The /speckit.plan command calls this as a documented step; we acknowledge the
call without touching CLAUDE.md.

If you want per-feature agent context files, write them at:
  .specify/agent-context/<feature-name>.md

EOF
        exit 0
        ;;
    claude)
        echo "[update-agent-context] No-op for ScriptHammer: CLAUDE.md is hand-curated." >&2
        exit 0
        ;;
    *)
        echo "[update-agent-context] Unknown agent '$AGENT_NAME' (only 'claude' is recognized). No-op." >&2
        exit 0
        ;;
esac
