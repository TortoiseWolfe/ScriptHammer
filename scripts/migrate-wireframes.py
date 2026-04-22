#!/usr/bin/env python3
"""
One-shot migration: docs/design/wireframes/<NNN-name>/ → features/<cat>/<NNN-name>/wireframes/

Walks the homegrown wireframe tree, derives each feature dir's target
category from features/<cat>/<NNN-name>/ (reading IMPLEMENTATION_ORDER.md
is not required — the filesystem already has the category partition).

For dirs with no matching feature (00-brand-identity, 000-landing-page),
creates `features/foundation/000-<slug>/` as a new feature home.

Uses `git mv` for SVGs, .issues.md, assignments.json, and UX_FLOW_ORDER.md
so history is preserved. Copies `docs/design/wireframes/includes/` into
each feature's `wireframes/includes/` (via plain cp + git add) so
`<use href="includes/..."/>` keeps resolving post-migration.

Run ONCE. Safe to re-run on a clean tree (it's idempotent — existing
destinations are left alone; only sources present under
docs/design/wireframes are moved).

Usage:
    docker compose exec scripthammer python3 scripts/migrate-wireframes.py [--dry-run]
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
LEGACY_ROOT = REPO_ROOT / "docs" / "design" / "wireframes"
FEATURES_ROOT = REPO_ROOT / "features"

# Overrides for sources without a direct features/<cat>/<NNN-name>/ match.
# Keyed by source dir name; value is the destination feature dir (relative
# to features/). The script creates these dirs if they don't exist.
SPECIAL_MAPPINGS = {
    "00-brand-identity": "foundation/000-brand-identity",
    "000-landing-page": "foundation/000-landing-page",
}

# Files to migrate from each source feature dir. Only these filenames are
# moved; anything else (e.g. scratch notes) stays in the source tree and
# will be cleaned up when Phase 5 deletes the legacy root entirely.
MIGRATION_GLOBS = [
    "*.svg",
    "*.issues.md",
    "assignments.json",
    "UX_FLOW_ORDER.md",
    "wireframe-plan.md",
    "WIREFRAME_PLAN.md",
]


def _is_tracked(path: Path) -> bool:
    """True iff `path` is tracked by git (not just on disk)."""
    rel = path.relative_to(REPO_ROOT)
    result = subprocess.run(
        ["git", "ls-files", "--error-unmatch", str(rel)],
        cwd=REPO_ROOT,
        capture_output=True,
    )
    return result.returncode == 0


def git_mv(src: Path, dst: Path, dry_run: bool) -> None:
    """Move src → dst, preserving git history when src is tracked.

    Tracked: `git mv` — history follows automatically.
    Untracked: shutil.move + git add — no history to preserve.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dry_run:
        print(f"  [dry] mv {src.relative_to(REPO_ROOT)} → {dst.relative_to(REPO_ROOT)}")
        return
    if _is_tracked(src):
        subprocess.run(["git", "mv", str(src), str(dst)], check=True, cwd=REPO_ROOT)
    else:
        shutil.move(str(src), str(dst))
        subprocess.run(["git", "add", str(dst)], check=True, cwd=REPO_ROOT)


def find_destination(source_name: str) -> Path | None:
    """Resolve docs/design/wireframes/<source_name>/ → features/<cat>/<source_name>/.

    Returns the target `features/<cat>/<feature>/` dir, or None if no match.
    """
    if source_name in SPECIAL_MAPPINGS:
        return FEATURES_ROOT / SPECIAL_MAPPINGS[source_name]

    # Look for any features/<cat>/<source_name>/ dir.
    for cat_dir in FEATURES_ROOT.iterdir():
        if not cat_dir.is_dir() or cat_dir.name.startswith("."):
            continue
        candidate = cat_dir / source_name
        if candidate.is_dir():
            return candidate
    return None


def migrate_feature(source_dir: Path, dry_run: bool) -> tuple[int, int]:
    """Migrate one feature dir. Returns (files_moved, files_skipped)."""
    source_name = source_dir.name
    dest_feature = find_destination(source_name)

    if dest_feature is None:
        print(f"SKIP  {source_name}: no matching features/<cat>/{source_name}/ dir")
        return 0, 1

    # Create the dest wireframes/ dir
    dest_wireframes = dest_feature / "wireframes"
    if not dry_run:
        dest_wireframes.mkdir(parents=True, exist_ok=True)

    moved = 0
    for glob in MIGRATION_GLOBS:
        for src in source_dir.glob(glob):
            if not src.is_file():
                continue
            dst = dest_wireframes / src.name
            if dst.exists():
                print(f"  SKIP  {src.name} — already exists at {dst.relative_to(REPO_ROOT)}")
                continue
            git_mv(src, dst, dry_run)
            moved += 1

    return moved, 0


def copy_includes(dest_feature_dirs: list[Path], dry_run: bool) -> None:
    """Copy docs/design/wireframes/includes/ into each feature's wireframes/includes/.

    Uses plain cp + git add (not git mv) because the same `includes/` dir is
    shared across all 27+ destinations. `git mv` would clobber after the first.
    """
    source_includes = LEGACY_ROOT / "includes"
    if not source_includes.is_dir():
        print("WARN: no docs/design/wireframes/includes/ to copy")
        return

    for feature_dir in dest_feature_dirs:
        dst = feature_dir / "wireframes" / "includes"
        if dst.is_dir():
            print(f"  SKIP  includes — already exists at {dst.relative_to(REPO_ROOT)}")
            continue
        if dry_run:
            print(f"  [dry] cp -r {source_includes.relative_to(REPO_ROOT)} → {dst.relative_to(REPO_ROOT)}")
            continue
        shutil.copytree(source_includes, dst)
        subprocess.run(
            ["git", "add", str(dst)],
            check=True,
            cwd=REPO_ROOT,
        )
        print(f"  copy  includes/ → {dst.relative_to(REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print actions without executing")
    args = parser.parse_args()

    if not LEGACY_ROOT.is_dir():
        print(f"No legacy tree at {LEGACY_ROOT} — nothing to migrate.")
        return 0

    # Find every docs/design/wireframes/<NNN or 00>*/ subdirectory.
    source_dirs = sorted(
        d for d in LEGACY_ROOT.iterdir()
        if d.is_dir()
        and d.name[:1].isdigit()  # starts with a digit (000-, 00-, 01, etc.)
    )

    print(f"Found {len(source_dirs)} legacy feature dirs to migrate")
    print(f"Target: {FEATURES_ROOT.relative_to(REPO_ROOT)}/<cat>/<feature>/wireframes/")
    print()

    total_moved = 0
    skipped_dirs = 0
    migrated_dests: list[Path] = []

    for source_dir in source_dirs:
        dest = find_destination(source_dir.name)
        if dest is None:
            skipped_dirs += 1
            print(f"SKIP  {source_dir.name}: no matching features/<cat>/{source_dir.name}/ dir")
            continue
        moved, skipped = migrate_feature(source_dir, args.dry_run)
        print(f"DONE  {source_dir.name} → {dest.relative_to(REPO_ROOT)}/wireframes/  ({moved} files)")
        total_moved += moved
        if moved > 0 or dest.is_dir():
            migrated_dests.append(dest)

    print()
    print("Copying shared includes/ into each feature's wireframes/includes/:")
    copy_includes(migrated_dests, args.dry_run)

    print()
    print(f"Migration {'(dry-run) ' if args.dry_run else ''}complete.")
    print(f"  moved: {total_moved} files across {len(migrated_dests)} features")
    if skipped_dirs:
        print(f"  skipped: {skipped_dirs} dirs (no matching feature; add to SPECIAL_MAPPINGS if needed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
