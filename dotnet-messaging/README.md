# .NET Messaging Backend (#266 / #265)

An ASP.NET Core 8 + EF Core alternative backend for ScriptHammer's messaging
domain — the second implementation behind the `MessagingDataProvider` interface
(#266). Flip `NEXT_PUBLIC_BACKEND_PROVIDER=dotnet` and the same UI + services run
against this server instead of Supabase. First concrete step of #265 (full
Supabase→.NET migration) and the enterprise-readiness epic #280.

## What it is

The `DotnetMessagingProvider` (in the Next.js app) calls this server's REST API
(`/api/messaging/...`). Because a .NET backend has no in-database `auth.uid()`,
this server **re-expresses the RLS authorization contract explicitly in C#** (the
14 named clauses catalogued in
[`docs/messaging/AUTHORIZATION-CONTRACT.md`](../docs/messaging/AUTHORIZATION-CONTRACT.md)):
it validates the Supabase JWT, extracts the caller's `sub`, and enforces
membership scoping, sender-only edit + 15-minute window, recipient-only mark-read,
soft-delete, etc. — the identical contract the shared conformance suite measures.

It is an **alternative API over the SAME messaging schema** (it reads/writes the
existing `messages`/`conversations`/… tables), so the DB-level invariants stay in
force for its writes too: `assign_sequence_number` (C13 gap-free sequence),
`uniq_messages_client_generated_id` (C14 idempotency), and
`enforce_message_update_columns` (#281 column guard).

## Layout

```
dotnet-messaging/
├── Dockerfile                    # multi-stage (dev = dotnet watch, prod = publish)
├── MessagingApi.sln
└── src/MessagingApi/
    ├── Program.cs                # JWT (ES256 via JWKS + HS256), CORS, EF Core, snake_case JSON
    ├── Auth/CallerContext.cs     # the auth.uid() replacement (sub from the JWT)
    ├── Data/AppDbContext.cs      # maps the existing Supabase tables (no EnsureCreated)
    ├── Data/MessagingQueries.cs  # CanAccessConversation / IsActiveMember (C1/C2/C7)
    ├── Models/                   # Message, Conversation, ConversationMember, UserConnection, UserProfile
    ├── Dtos/RequestDtos.cs       # camelCase request bodies the provider sends
    └── Controllers/              # Conversations, Messages, Profiles — the 10-endpoint contract
```

## JWT validation

The server validates the Supabase access token the browser sends
(`Authorization: Bearer …`):

- **Cloud** Supabase signs with **ES256** — validated via the project JWKS
  (`SUPABASE_URL` → `/auth/v1/.well-known/openid-configuration`).
- **Local/self-hosted** GoTrue signs with **HS256** — validated with
  `SUPABASE_JWT_SECRET` (the same secret GoTrue/PostgREST use).

Both signing keys are offered, so either token type validates. `aud=authenticated`
is required; the `sub` claim becomes the caller id.

## Run it

```bash
# Point the DB at the local bundled Supabase Postgres (default), plus the app:
docker compose --profile supabase --profile dotnet up

# Or standalone against any Postgres via ConnectionStrings__DefaultConnection.
```

Then, in the app's `.env`:

```
NEXT_PUBLIC_BACKEND_PROVIDER=dotnet
NEXT_PUBLIC_DOTNET_API_URL=http://localhost:5099
```

Env the server reads: `ConnectionStrings__DefaultConnection`, `SUPABASE_JWT_SECRET`,
`SUPABASE_URL` (for ES256/JWKS), `CORS_ORIGINS`.

## Conformance

The shared suite (`tests/contract/messaging-provider.contract.ts`) runs the
IDENTICAL contract assertions against this server via the `.dotnet` runner:

```bash
DOTNET_API_URL=http://127.0.0.1:5099 pnpm test:rls
```

It seeds users + a conversation via Supabase, signs in to mint real tokens, and
drives the `DotnetMessagingProvider` against the live server — so a dropped rule
turns the same test that passes on Supabase red on .NET.

**Requires** a Postgres the server can reach that also holds the seeded data
(i.e. the same Supabase the suite seeds into). In a WSL2/Docker environment where
the cloud project's Postgres is IPv6-only and unreachable from the container, run
against a local full Supabase stack instead (see the local-init caveat below).

## Status

- ✅ Server implements all 10 endpoints + the messaging authorization contract in C#;
  compiles (`dotnet publish -c Release`), boots, connects to Postgres, validates
  real ES256/HS256 Supabase JWTs. The shared conformance suite drives it end-to-end,
  and the **Conformance** CI workflow (`.github/workflows/conformance.yml`) gates every
  PR by running the suite against both backends on a local Supabase + .NET stack.
- ✅ Runs under a least-privilege `dotnet_app` DB role subject to RLS (#321); the #281
  column-guard trigger is a live backstop for its writes.
- Deferred slices (still on direct-Supabase, not behind the provider seam or this
  server): connections/groups/keys/GDPR endpoints, and SignalR realtime (v1 uses the
  provider's polling fallback). See
  [`docs/messaging/AUTHORIZATION-CONTRACT.md`](../docs/messaging/AUTHORIZATION-CONTRACT.md)
  → deferred backlog.
