#!/usr/bin/env python3
"""
Back up a Supabase project — DATA **and** CONFIGURATION — before any destructive
step.

    python3 scripts/supabase/backup-project.py <project-ref> [--out DIR]

WHY THIS EXISTS, AND WHY IT IS NOT JUST A DATA DUMP
On 2026-08-07 the ScriptHammer project was deleted and rebuilt in a different
organisation (#567). The database backup was thorough and verified — 24
`auth.users`, identical uuid sets, 17 password hashes, 0 orphans, the restore
rehearsed against a throwaway database first. It was still not a backup of the
PROJECT, because a Supabase project holds things that live nowhere in Postgres:

  - OAuth provider client ids and secrets (Google, GitHub)
  - the CAPTCHA / Turnstile secret
  - SMTP credentials, site_url, redirect allow-list
  - Edge Function secret NAMES

Deleting the project destroyed all of it. Supabase deletes are HARD — afterwards
`GET /v1/projects/<ref>` returns `"Resource has been removed"`, the ref is absent
from every listing, and `/restore` returns 400. Three third-party credentials were
unrecoverable from this repo, from `.env`, from GitHub secrets, or from anywhere
on the machine, and **three of twenty users had no password and could sign in only
via OAuth**.

So: run this, not an ad-hoc `json_agg` loop, and read
`config/auth.json` before you delete anything.

WHAT THIS CANNOT DO. The Management API returns secret NAMES for Edge Functions,
never their values, and it masks some auth secrets. Those must be held outside the
project — in the owner-only `.env` used by `pnpm supabase:secrets`, an explicit
owner-only JSON sidecar, or a password manager. This script prints a loud warning
listing exactly which values it could NOT capture, so the gap is visible before it
becomes irreversible rather than after.

Pairs with `restore-from-backup.py`.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

API = "https://api.supabase.com/v1"

# Config endpoints worth capturing. `auth` is the one that mattered: it carries the
# OAuth provider settings and the CAPTCHA provider/secret fields.
CONFIG_ENDPOINTS = [
    ("config/auth", "auth"),
    ("secrets", "edge_function_secret_names"),
    ("functions", "functions"),
    ("config/database/postgres", "postgres"),
]


def api_get(path: str, token: str):
    out = subprocess.run(
        ["curl", "-s", "-4", "--max-time", "90",
         f"{API}/{path}", "-H", f"Authorization: Bearer {token}"],
        capture_output=True, text=True,
    ).stdout
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"_unparsed": out[:400]}


def sql(ref: str, token: str, query: str):
    fd, path = tempfile.mkstemp(suffix=".json")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump({"query": query}, fh)
        out = subprocess.run(
            ["curl", "-s", "-4", "--max-time", "120", "-X", "POST",
             f"{API}/projects/{ref}/database/query",
             "-H", f"Authorization: Bearer {token}",
             "-H", "Content-Type: application/json", "-d", f"@{path}"],
            capture_output=True, text=True,
        ).stdout
    finally:
        os.unlink(path)
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("ref")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    if not token:
        print("SUPABASE_ACCESS_TOKEN is required", file=sys.stderr)
        return 1

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    out = args.out or os.path.expanduser(f"~/supabase-backup-{stamp}")
    os.makedirs(os.path.join(out, "config"), exist_ok=True)
    os.chmod(out, 0o700)

    print(f"backing up {args.ref} -> {out}")

    # ---- configuration FIRST. It is the part that cannot be reconstructed, and
    # putting it first means a run that dies halfway still captured it.
    print("\nconfiguration:")
    for path, name in CONFIG_ENDPOINTS:
        data = api_get(f"projects/{args.ref}/{path}", token)
        with open(os.path.join(out, "config", f"{name}.json"), "w") as fh:
            json.dump(data, fh, indent=2)
        n = len(data) if isinstance(data, list) else len(data or {})
        print(f"  {name:<30} {n} field(s)")

    # ---- data
    tables = sql(args.ref, token,
                 "select string_agg(tablename,' ') from pg_tables "
                 "where schemaname='public'")
    names = (tables[0].get("string_agg") if tables else "") or ""
    print("\ndata:")
    for t in names.split():
        rows = sql(args.ref, token,
                   f"select coalesce(json_agg(x),'[]'::json) from public.{t} x")
        payload = rows[0].get("coalesce", []) if rows else []
        with open(os.path.join(out, f"public.{t}.json"), "w") as fh:
            json.dump(payload, fh)
        print(f"  public.{t:<28} {len(payload)}")

    for t in ("users", "identities"):
        rows = sql(args.ref, token,
                   f"select coalesce(json_agg(x),'[]'::json) from auth.{t} x")
        payload = rows[0].get("coalesce", []) if rows else []
        with open(os.path.join(out, f"auth.{t}.json"), "w") as fh:
            json.dump(payload, fh)
        print(f"  auth.{t:<30} {len(payload)}")

    # ---- the part that is NOT captured, said out loud
    auth_cfg = {}
    try:
        with open(os.path.join(out, "config", "auth.json")) as fh:
            auth_cfg = json.load(fh)
    except (OSError, json.JSONDecodeError):
        pass

    missing = []
    for key, label in [
        ("external_google_secret", "Google OAuth client secret"),
        ("external_github_secret", "GitHub OAuth client secret"),
        ("security_captcha_secret", "CAPTCHA / Turnstile secret"),
        ("smtp_pass", "SMTP password"),
    ]:
        v = auth_cfg.get(key)
        if not v or set(str(v)) <= {"*"}:
            missing.append(label)

    print("\n" + "=" * 68)
    if missing:
        print("NOT CAPTURED — the API masks or omits these. They exist ONLY in the")
        print("third-party console that issued them. If you delete this project")
        print("without copying them out, they are GONE (Supabase deletes are hard):")
        for m in missing:
            print(f"   - {m}")
        print("")
        print("Also check anything pointing AT this project by ref, which will")
        print("break on a new one: OAuth redirect URIs, Stripe/PayPal webhook URLs.")
    else:
        print("All tracked config values were captured.")
    print("=" * 68)
    print(f"\nbackup: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
