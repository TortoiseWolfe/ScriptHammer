#!/usr/bin/env bash
#
# serve-basepath.sh — build + serve a basePath-prefixed static export so the
# `basepath` Playwright project (tests/e2e/basepath/**, issue #157) can exercise
# GitHub Pages project-site behavior that the root-anchored E2E suite can't see.
#
# The template deploys to a custom domain (basePath ''), so the normal E2E build
# serves at the root. A fork on a project-site needs a /RepoName basePath, and
# the whole class of "auth redirect / hand-built URL escapes the prefix" bug is
# invisible unless we actually build AND serve under that prefix. `serve` has no
# subpath flag, so we symlink a wrapper dir: serve-root/<name> -> ../out-basepath.
#
# Usage:
#   scripts/serve-basepath.sh build         # build the prefixed export only
#   scripts/serve-basepath.sh serve [PORT]  # symlink-serve an existing build (fg)
#   scripts/serve-basepath.sh all [PORT]    # build then serve (fg)
#
# Env:
#   BASE_PATH   the prefix, default /ScriptHammer
#   OUT_DIR     export dir, default out-basepath
#   PORT        serve port, default 3000 (arg overrides)

set -euo pipefail

BASE_PATH="${BASE_PATH:-/ScriptHammer}"
OUT_DIR="${OUT_DIR:-out-basepath}"
SERVE_ROOT="${SERVE_ROOT:-serve-root}"
# BASE_PATH is /ScriptHammer → the symlink name is ScriptHammer.
PREFIX_NAME="${BASE_PATH#/}"

cmd="${1:-all}"
PORT="${2:-${PORT:-3000}}"

build() {
  echo "==> Building basePath-prefixed export (${BASE_PATH}) into ${OUT_DIR}/"
  rm -rf "${OUT_DIR}"
  # A non-empty NEXT_PUBLIC_BASE_PATH wins over detect-project.js (next.config.ts),
  # so this bakes assets at ${BASE_PATH}/_next/* and injects the client basePath.
  #
  # NEXT_DIST_DIR does double duty: it keeps this build off the root .next AND,
  # under `output: 'export'` on Next 15.5, the static export lands directly in
  # the distDir (it does NOT create out/). So point distDir at OUT_DIR and the
  # export is already where we want it — no mv, no out/ to stat.
  NEXT_PUBLIC_BASE_PATH="${BASE_PATH}" NEXT_DIST_DIR="${OUT_DIR}" pnpm build
  if [ ! -d "${OUT_DIR}/sign-up" ]; then
    echo "::error::basePath export missing ${OUT_DIR}/sign-up — build did not export as expected" >&2
    exit 1
  fi
  echo "==> Export ready: ${OUT_DIR}/ (sign-up present)"
}

serve() {
  echo "==> Symlink-serving ${OUT_DIR} under ${BASE_PATH} on :${PORT}"
  rm -rf "${SERVE_ROOT}"
  mkdir -p "${SERVE_ROOT}"
  ln -s "../${OUT_DIR}" "${SERVE_ROOT}/${PREFIX_NAME}"
  # -n: don't ask to copy to clipboard / open browser (non-interactive CI).
  exec pnpm exec serve "${SERVE_ROOT}" -l "${PORT}" -n
}

case "${cmd}" in
  build) build ;;
  serve) serve ;;
  all) build; serve ;;
  *)
    echo "usage: $0 {build|serve|all} [PORT]" >&2
    exit 2
    ;;
esac
