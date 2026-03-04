-- Post-init bootstrap for the local Supabase profile.
--
-- Mounted at /etc/postgresql.schema.sql. That path is a hard-coded hook in
-- the supabase/postgres image: migrate.sh runs it as supabase_admin AFTER
-- init-scripts/ and AFTER the image's own 38 built-in migrations/ (demote
-- postgres, create realtime schema, transfer auth.* ownership, pg_graphql,
-- vault, all of it). Those 38 migrations are what the original compose
-- config was accidentally SHADOWING by mounting ./supabase/migrations/ as
-- a DIRECTORY over /docker-entrypoint-initdb.d/migrations/ -- that bug is
-- fixed now (single-file mount), so we only need to cover what the image
-- genuinely leaves to the operator. Two things:
--
-- psql is invoked with -f and --no-password over local socket; the backtick
-- below is psql meta-syntax (shell-out), not a YAML or eval hazard.

\set pgpass `echo "$POSTGRES_PASSWORD"`

-- ── 1. Role passwords ──────────────────────────────────────────────────────
-- init-scripts/ create these roles with LOGIN but no PASSWORD clause. No
-- built-in migration sets them either -- migrate.sh itself only patches
-- supabase_admin (line 46), and its own comment at the /etc/postgresql
-- .schema.sql hook calls out "update role passwords" as the intended use.
-- Without these, every TCP client crash-loops on 28P01.

ALTER ROLE authenticator           WITH PASSWORD :'pgpass';
ALTER ROLE supabase_auth_admin     WITH PASSWORD :'pgpass';
ALTER ROLE supabase_storage_admin  WITH PASSWORD :'pgpass';
ALTER ROLE supabase_read_only_user WITH PASSWORD :'pgpass';

-- ── 2. _realtime schema ────────────────────────────────────────────────────
-- Not the same thing as the `realtime` schema (no underscore) that base
-- migration 20211118015519 creates for WALRUS. _realtime is Phoenix/Ecto's
-- private migration-state schema. docker-compose.yml :216 sets
-- DB_AFTER_CONNECT_QUERY to SET search_path TO _realtime, then Ecto tries to
-- create schema_migrations there. 3F000 invalid_schema_name. Zero hits for
-- _realtime anywhere in the base image. The official self-hosted stack
-- mounts a volumes/db/realtime.sql doing exactly this. Realtime connects as
-- supabase_admin (compose :213), which is who is running this script, so
-- default ownership is already correct.

CREATE SCHEMA IF NOT EXISTS _realtime;
