#!/usr/bin/env bash
# ScriptHammer SpecKit harness config — sourced by every bash helper in this dir.
#
# Why this file exists: ScriptHammer keeps specs under `features/<category>/<NNN-name>/`
# instead of upstream SpecKit's flat `specs/<NNN-name>/`. Rather than fork the whole
# upstream toolchain, we override the search root + gloss the recursive lookup here.
#
# Upstream layout:   specs/004-foo/spec.md
# ScriptHammer:      features/foundation/004-foo/spec.md
#                    features/auth-oauth/013-oauth-messaging-password/spec.md
#                    etc.
#
# The two divergent helpers (find_feature_dir_by_prefix + get_current_branch's
# non-git fallback) consult SPEC_KIT_FEATURES_ROOT (this file) instead of
# hardcoded "specs/". New feature dirs created via create-new-feature.sh land
# under SPEC_KIT_DEFAULT_CATEGORY until a human moves them.

# Repo-relative root dir under which feature specs live.
# Search is recursive: SPEC_KIT_FEATURES_ROOT/*/<NNN-name>/
SPEC_KIT_FEATURES_ROOT="${SPEC_KIT_FEATURES_ROOT:-features}"

# Default category subdir for create-new-feature.sh.
# Humans triage from _uncategorized/ into the right category afterwards.
SPEC_KIT_DEFAULT_CATEGORY="${SPEC_KIT_DEFAULT_CATEGORY:-_uncategorized}"
