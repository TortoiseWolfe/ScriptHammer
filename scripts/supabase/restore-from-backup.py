#!/usr/bin/env python3
"""
Restore a Supabase project from a JSON backup taken by the Management API.

WHY THIS EXISTS
The ScriptHammer project has to move to a different organisation (#567 fallout:
the free-tier quota is per-USER across all orgs, and the burned org cannot host a
working project). Moving means delete-and-recreate, and delete-and-recreate with
21 real accounts is only defensible if the restore has been PROVEN first — against
a throwaway database, while the real one still exists.

    dry run   : python3 scripts/supabase/restore-from-backup.py <dir> --target local
    real run  : python3 scripts/supabase/restore-from-backup.py <dir> --target <ref>

THE UUIDS ARE THE WHOLE GAME. `user_encryption_keys`, `user_profiles`,
`user_connections` and every RLS policy key off `auth.users.id`. A restore that
creates fresh users and copies rows across would look successful — people could log
in — while silently orphaning every encryption key, which is unrecoverable because
the messages are E2E encrypted. So rows are inserted with their original ids, and
the verification below asserts zero orphans rather than merely counting rows.

`encrypted_password` is carried over as-is (it is a bcrypt hash, not a password), so
restored users keep their existing credentials and are not forced through a reset.

Insert order follows the foreign keys: auth.users -> auth.identities -> everything
in public that references a user.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

# FK order. Anything not named here is restored afterwards in arbitrary order,
# which is safe because the remaining tables reference only these.
ORDERED = [
    ("auth", "users"),
    ("auth", "identities"),
    ("public", "user_profiles"),
    ("public", "user_encryption_keys"),
    ("public", "user_connections"),
    ("public", "conversations"),
]

# Wiped before a restore, in reverse dependency order. `auth.users` last because
# everything else points at it.
#
# ORDERS BEFORE PAYMENT_INTENTS — `orders.intent_id` references
# `payment_intents.id`, so the other way round fails the FK. Caught by the local
# dry run; on a real target the wipe would have half-completed and left the
# database in a state neither old nor new.
WIPE_ORDER = [
    "public.conversation_members",
    "public.conversation_keys",
    "public.group_keys",
    "public.messages",
    "public.typing_indicators",
    "public.user_connections",
    "public.user_encryption_keys",
    "public.auth_audit_logs",
    "public.rate_limit_attempts",
    "public.webhook_events",
    "public.orders",
    "public.payment_results",
    "public.subscriptions",
    "public.payment_intents",
    "public.user_profiles",
    "public.conversations",
    "auth.identities",
    "auth.users",
]


# NEITHER TRANSPORT MAY CARRY THE PAYLOAD IN ARGV. 1,910 conversations produce a
# statement far past ARG_MAX, and the failure is `OSError: [Errno 7] Argument list
# too long` from the exec itself — nothing to do with SQL, and it lands only on the
# big tables, so a restore tested on small ones looks fine. SQL goes to psql on
# stdin; the remote body goes to a temp file read with `-d @file`.

def run_local(sql: str) -> str:
    """psql inside the compose stack, SQL on stdin. Raises on failure."""
    p = subprocess.run(
        [
            "docker", "compose", "exec", "-T", "supabase-db",
            "psql", "-U", "postgres", "-d", "postgres",
            "-v", "ON_ERROR_STOP=1", "-tA",
        ],
        input=sql, capture_output=True, text=True,
    )
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip()[:600])
    return p.stdout.strip()


def run_remote(sql: str, ref: str, token: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".json")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump({"query": sql}, fh)
        p = subprocess.run(
            ["curl", "-s", "-4", "--max-time", "300", "-X", "POST",
             f"https://api.supabase.com/v1/projects/{ref}/database/query",
             "-H", f"Authorization: Bearer {token}",
             "-H", "Content-Type: application/json", "-d", f"@{path}"],
            capture_output=True, text=True,
        )
    finally:
        os.unlink(path)
    out = p.stdout
    try:
        j = json.loads(out)
        if isinstance(j, dict) and "message" in j:
            raise RuntimeError(j["message"][:600])
    except json.JSONDecodeError:
        pass
    return out


def load(d: str, schema: str, table: str):
    path = os.path.join(d, f"{schema}.{table}.json")
    if not os.path.exists(path):
        return None
    with open(path) as fh:
        return json.load(fh)


def insert_sql(schema: str, table: str, rows: list, cols: list, pk: list) -> str:
    """
    json_populate_recordset maps JSON keys to columns by name, so the payload
    survives a column being added later.

    THE COLUMN LIST IS NOT OPTIONAL. `auth.users.confirmed_at` is a GENERATED
    column and Postgres refuses any non-DEFAULT value for it — a bare
    `INSERT INTO ... SELECT *` dies on the very first table. `cols` is the
    non-generated set, read from the target's own catalog rather than hardcoded,
    so this keeps working if Supabase generates another one.

    Dollar-quoting rather than escaping: the payload carries arbitrary user text
    (bios, display names, message metadata) and any hand-rolled quote-doubling is
    a bug waiting to happen.
    """
    payload = json.dumps(rows)
    tag = "bk"
    while f"${tag}$" in payload:
        tag += "x"
    collist = ", ".join(f'"{c}"' for c in cols)

    # UPSERT, NOT `DO NOTHING`. `on_auth_user_created` fires as each auth.users
    # row is inserted and writes a DEFAULT user_profiles row. With DO NOTHING the
    # trigger's placeholder won and the real profile was silently discarded: the
    # first production restore came back with 11 wrong fields, including the
    # owner's `is_admin` flipped True -> False and every display_name nulled.
    #
    # Nothing else caught it. Row counts matched, the uuid sets were identical and
    # every orphan check was zero — because the rows existed, they were just the
    # wrong rows. Only a field-by-field diff against the backup found it.
    #
    # The backup is the authority, so conflicts overwrite.
    if pk:
        target = ", ".join(f'"{c}"' for c in pk)
        sets = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in pk)
        conflict = f"ON CONFLICT ({target}) DO UPDATE SET {sets}" if sets else "ON CONFLICT DO NOTHING"
    else:
        conflict = "ON CONFLICT DO NOTHING"
    return (
        f"INSERT INTO {schema}.{table} ({collist}) "
        f"SELECT {collist} FROM json_populate_recordset(NULL::{schema}.{table}, ${tag}${payload}${tag}$) "
        f"{conflict}"
    )


def primary_key(exec_sql, schema: str, table: str) -> list:
    """Primary-key columns, used as the ON CONFLICT target."""
    out = exec_sql(
        "select string_agg(a.attname, ',' order by k.ord) "
        "from pg_index i "
        "join lateral unnest(i.indkey) with ordinality as k(attnum, ord) on true "
        "join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum "
        f"where i.indrelid = '{schema}.{table}'::regclass and i.indisprimary"
    )
    raw = out.strip()
    if raw.startswith("["):
        try:
            raw = json.loads(raw)[0]["string_agg"] or ""
        except (json.JSONDecodeError, IndexError, KeyError, TypeError):
            raw = ""
    return [c for c in raw.split(",") if c]


def insert_chunked(exec_sql, schema: str, table: str, rows: list, cols: list,
                   pk: list, size: int = 500) -> None:
    """
    Insert in slices.

    `auth_audit_logs` is 7,661 rows and the Management API answered
    "request entity too large" — a transport limit, not SQL, and it only appears
    on the biggest table. The local dry run never hit it because psql-on-stdin
    has no such ceiling, so this is the one failure mode a local rehearsal
    cannot surface. 500 rows keeps the biggest table here comfortably under it.
    """
    for i in range(0, len(rows), size):
        exec_sql(insert_sql(schema, table, rows[i:i + size], cols, pk))


def insertable_columns(exec_sql, schema: str, table: str) -> list:
    """Columns we are allowed to write: everything except GENERATED ALWAYS."""
    out = exec_sql(
        "select string_agg(column_name, ',' order by ordinal_position) "
        "from information_schema.columns "
        f"where table_schema='{schema}' and table_name='{table}' "
        "and is_generated = 'NEVER'"
    )
    raw = out.strip()
    if raw.startswith("["):  # remote returns JSON
        try:
            raw = json.loads(raw)[0]["string_agg"] or ""
        except (json.JSONDecodeError, IndexError, KeyError, TypeError):
            raw = ""
    return [c for c in raw.split(",") if c]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("backup_dir")
    ap.add_argument("--target", required=True, help="'local' or a Supabase project ref")
    ap.add_argument("--wipe", action="store_true", help="clear target tables first")
    args = ap.parse_args()

    d = args.backup_dir
    if not os.path.isdir(d):
        print(f"no such backup dir: {d}", file=sys.stderr)
        return 1

    if args.target == "local":
        exec_sql = run_local
    else:
        token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
        if not token:
            print("SUPABASE_ACCESS_TOKEN required for a remote target", file=sys.stderr)
            return 1
        exec_sql = lambda s: run_remote(s, args.target, token)  # noqa: E731

    if args.wipe:
        print("wiping target…")
        for t in WIPE_ORDER:
            try:
                exec_sql(f"DELETE FROM {t}")
            except RuntimeError as e:
                print(f"  skip {t}: {str(e)[:80]}")
        print("  done")

    done = set()
    print("restoring…")
    for schema, table in ORDERED:
        rows = load(d, schema, table)
        if rows is None:
            continue
        done.add((schema, table))
        if not rows:
            print(f"  {schema}.{table:<24} 0 (empty)")
            continue
        cols = insertable_columns(exec_sql, schema, table)
        pk = primary_key(exec_sql, schema, table)
        insert_chunked(exec_sql, schema, table, rows, cols, pk)
        print(f"  {schema}.{table:<24} {len(rows)}")

    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".json"):
            continue
        schema, table = fn[:-5].split(".", 1)
        if (schema, table) in done:
            continue
        rows = load(d, schema, table)
        if not rows:
            continue
        try:
            cols = insertable_columns(exec_sql, schema, table)
            pk = primary_key(exec_sql, schema, table)
            insert_chunked(exec_sql, schema, table, rows, cols, pk)
            print(f"  {schema}.{table:<24} {len(rows)}")
        except RuntimeError as e:
            print(f"  {schema}.{table:<24} FAILED: {str(e)[:120]}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
