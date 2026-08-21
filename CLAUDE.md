# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Core Development Principles

1. **Proper Solutions Over Quick Fixes** - Implement correctly the first time
2. **Root Cause Analysis** - Fix underlying issues, not symptoms
3. **Stability Over Speed** - This is a production template
4. **Clean Architecture** - Follow established patterns consistently
5. **No Technical Debt** - Never commit TODOs or workarounds

## Docker-First Development (MANDATORY)

**CRITICAL**: This project REQUIRES Docker. Local pnpm/npm commands are NOT supported.

### NEVER Install Packages Locally

**ABSOLUTELY FORBIDDEN** - Never run these commands on the host machine:

```bash
# ❌ CRITICAL NO - NEVER do any of these locally
npm install
npm install --no-save <package>
pnpm install
pnpm add <package>
yarn install
npx <anything>

# ✅ CORRECT - Always use Docker
docker compose exec scripthammer pnpm install
docker compose exec scripthammer pnpm add <package>
```

**Why this is critical:**

- Creates local `node_modules` with wrong permissions (Docker-owned)
- Causes conflicts between host and container dependencies
- Breaks the Docker-first architecture
- Creates cleanup nightmares (Docker-owned files can't be deleted by host user)

**If you accidentally installed locally:**

```bash
docker compose down
docker compose run --rm scripthammer rm -rf node_modules
docker compose up
```

### NEVER Use sudo - Use Docker Instead

When encountering permission errors, **NEVER use `sudo`**. Use Docker:

```bash
# ❌ WRONG - Don't do this
sudo chown -R $USER:$USER .next
sudo rm -rf node_modules

# ✅ CORRECT - Use Docker
docker compose exec scripthammer rm -rf node_modules
docker compose down && docker compose up
```

**Why**: The container runs as your user (UID/GID from .env). Docker commands execute with correct permissions automatically.

**Never `rm -rf .next` in the dev container.** That is the dev server's live build
directory — deleting it 500s every route until it recompiles (#293). It used to be
recommended here, which is how the habit spread into the hooks and CI scripts. To
clear the dev cache, restart the container (the entrypoint does it for you):

```bash
docker compose restart scripthammer
```

**Permission errors? Always try:**

1. `docker compose down && docker compose up` (restarts container, cleans .next)
2. `docker compose exec scripthammer pnpm run docker:clean`

### Essential Commands

```bash
# Start development
docker compose up

# Development server
docker compose exec scripthammer pnpm run dev

# Run tests
docker compose exec scripthammer pnpm test
docker compose exec scripthammer pnpm run test:suite    # Full suite

# Production build — its OWN container, never `exec scripthammer` (#293).
# `next dev` and `next build` both own /app/.next; building in the dev
# container wipes what it is serving and 500s every route. The `builder`
# service is the same image with its own .next volume.
docker compose run --rm builder pnpm build

# Storybook
docker compose exec scripthammer pnpm run storybook

# E2E tests
docker compose exec scripthammer pnpm exec playwright test

# Type checking & linting
docker compose exec scripthammer pnpm run type-check
docker compose exec scripthammer pnpm run lint

# Clean start if issues
docker compose exec scripthammer pnpm run docker:clean
```

### Git Commits from Docker

Git hooks may fail when running locally if the repo was set up inside Docker. Always commit from inside the container:

```bash
# Configure git identity (add to .env)
GIT_AUTHOR_NAME=Your Name
GIT_AUTHOR_EMAIL=your@email.com

# Commit from container (hooks run correctly)
docker compose exec scripthammer git add -A
docker compose exec scripthammer git commit -m "Your commit message"

# Push from host (uses your SSH keys)
git push
```

### Supabase Keep-Alive

Supabase Cloud free tier auto-pauses after 7 days. If paused:

```bash
docker compose exec scripthammer pnpm run prime
```

## Component Structure (MANDATORY)

Components must follow the 5-file pattern or CI/CD will fail:

```
ComponentName/
├── index.tsx                             # Barrel export
├── ComponentName.tsx                     # Main component
├── ComponentName.test.tsx                # Unit tests (REQUIRED)
├── ComponentName.stories.tsx             # Storybook (REQUIRED)
└── ComponentName.accessibility.test.tsx  # A11y tests (REQUIRED)
```

**Always use the generator:**

```bash
docker compose exec scripthammer pnpm run generate:component
```

See `docs/CREATING_COMPONENTS.md` for details.

## Architecture Overview

- **Next.js 15** with App Router, static export
- **React 19** with TypeScript strict mode
- **Tailwind CSS 4** + DaisyUI (35 themes: 2 house + 32 DaisyUI)
- **Supabase** - Auth, Database, Storage, Realtime
- **PWA** with Service Worker (offline support)
- **Testing**: Vitest (unit), Playwright (E2E), Pa11y (a11y)

## Static Hosting Constraint

This app is deployed to GitHub Pages (static hosting). This means:

- NO server-side API routes (`src/app/api/` won't work in production)
- NO access to non-NEXT*PUBLIC* environment variables in browser
- All server-side logic must be in Supabase (database, Edge Functions, or triggers)

When implementing features that need secrets:

- Use Supabase Vault for secure storage
- Use Edge Functions for server-side logic
- Or design client-side solutions that don't require secrets

**Example**: The welcome message system uses ECDH shared secret symmetry to encrypt
messages "from" admin without needing admin's password at runtime. The admin's
public key is pre-stored in the database, and `ECDH(user_private, admin_public)`
produces the same shared secret as `ECDH(admin_private, user_public)`.

### Key Paths

```
src/
├── app/           # Next.js pages
├── components/    # Atomic design (subatomic/atomic/molecular/organisms/templates)
├── contexts/      # React contexts (AuthContext, etc.)
├── hooks/         # Custom hooks
├── lib/           # Core libraries
├── services/      # Business logic
└── types/         # TypeScript definitions

tests/
├── unit/          # Unit tests
├── integration/   # Integration tests
├── contract/      # Contract tests
├── e2e/           # Playwright E2E tests
└── setup.ts       # Vitest setup

docker/            # Docker configuration
├── Dockerfile     # Main Dockerfile
└── docker-compose.e2e.yml  # E2E testing compose

docs/specs/        # Feature specifications (SpecKit artifacts)
tools/templates/   # Component generator templates
```

## PRP/SpecKit Workflow

For features taking >1 day:

1. Write PRP: `docs/prp-docs/<feature>-prp.md`
2. Create branch: `./scripts/prp-to-feature.sh <feature> <number>`
3. Run SpecKit (full 7-step workflow):
   ```
   /specify → /clarify → /plan → /checklist → /tasks → /analyze → /implement
   ```

### SpecKit Commands

| Command      | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `/specify`   | Create feature specification from PRP                |
| `/clarify`   | Ask clarifying questions, encode answers into spec   |
| `/plan`      | Generate implementation plan from spec               |
| `/checklist` | Generate custom checklist for the feature            |
| `/tasks`     | Generate dependency-ordered tasks.md                 |
| `/analyze`   | Cross-artifact consistency check (spec, plan, tasks) |
| `/implement` | Execute the implementation plan                      |

See `docs/prp-docs/SPECKIT-PRP-GUIDE.md` for details.

## Common Issues & Solutions

### Permission Errors

**Always use Docker, never sudo:**

```bash
docker compose down && docker compose up
```

### Slow Supabase (10-30 seconds)

Instance paused after inactivity:

```bash
docker compose exec scripthammer pnpm run prime
```

### Tailwind CSS Not Loading

1. Don't import Leaflet CSS in `globals.css`
2. Import Leaflet CSS only in map components
3. Restart container after CSS changes

### Dev Server Port (pinned)

`SH_PORT` in `.env` pins the host port so the dev URL survives container
restarts and self-heal events (issue #230). On this machine the convention is
`SH_PORT=3002` (3000 is held by the RescueDogs container):
`http://127.0.0.1:3002/ScriptHammer/`

If `SH_PORT` is unset, Docker assigns an ephemeral port per restart — find it
with `docker compose port scripthammer 3000`. "Port in use" means another
instance pinned the same port — change `SH_PORT` in `.env`; don't kill host
processes.

### 500s on Every Route (.next corruption)

Signature: `Cannot read properties of undefined (reading '/_app')` / ENOENT
`vendor-chunks` after bakes or branch switches while the dev server runs.
The entrypoint supervisor self-heals (issue #230): after ~60s of sustained
HTTP 5xx it recycles `.next` and relaunches `next dev` in-place — port
unchanged, back to 200 within ~2 minutes (watch for `[self-heal]` in
`docker compose logs`). Manual fallback: `docker compose restart scripthammer`.

## Test Users

**Primary** (required):

- Email: `test@example.com`
- Password: `TestPassword123!`

**Secondary** (optional - for email verification tests):

- Configure in `.env`: `TEST_USER_SECONDARY_EMAIL`, `TEST_USER_SECONDARY_PASSWORD`

## GitHub Actions Secrets AND Variables

**Settings → Secrets and variables → Actions has two tabs, and which one a value lives on is
load-bearing.** `deploy.yml` reads the Supabase pair from `vars.*`. Put them in Secrets and nothing
errors — they arrive as empty strings, the deploy goes green, and the bundle ships with no backend.

### Secrets — one, and the deploy hard-fails without it

```
NEXT_PUBLIC_PAGESPEED_API_KEY=your-google-api-key
```

`.github/workflows/deploy.yml:38-46` exits 1 before `pnpm build` when this is empty. Both fork docs
called it "Optional" until #898's follow-up; it is the single wall between a first push and any site
existing.

### Variables — not secrets

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_DEPLOY_URL=https://your-domain.com
```

The two URLs matter even before a custom domain: unset, `sitemap.xml`/`robots.txt` advertise a
`github.io` origin, and `retain-previous-assets.mjs` falls back to crawling **scripthammer.com**
rather than your own site — printing "retained N asset(s)" as though it worked.

### Optional but Recommended

```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_AUTHOR_NAME=Your Name
NEXT_PUBLIC_AUTHOR_EMAIL=your@email.com
```

See `README.md` for the complete list of available secrets.

## Documentation

| Topic               | Location                                   |
| ------------------- | ------------------------------------------ |
| Authentication      | `docs/AUTH-SETUP.md`                       |
| Messaging System    | `docs/messaging/QUICKSTART.md`             |
| Messaging Contract  | `docs/messaging/AUTHORIZATION-CONTRACT.md` |
| Payment Integration | `docs/features/payment-integration.md`     |
| Security            | `.github/SECURITY.md`                      |
| Mobile-First Design | `docs/MOBILE-FIRST.md`                     |
| Component Creation  | `docs/CREATING_COMPONENTS.md`              |
| Template Setup      | `docs/TEMPLATE-GUIDE.md`                   |
| Testing Guide       | `docs/project/TESTING.md`                  |
| Forking Guide       | `docs/FORKING.md`                          |

## Supabase Database Migrations (CRITICAL)

**NEVER create separate migration files.** This project uses a **monolithic migration file**:

```
supabase/migrations/20251006_complete_monolithic_setup.sql
```

### Adding Schema Changes

1. **Edit the monolithic file directly** - Add new tables, columns, indexes to the appropriate section
2. **Use `IF NOT EXISTS`** - All CREATE statements must be idempotent
3. **Add to existing transaction** - New schema goes inside the `BEGIN;`...`COMMIT;` block
4. **Execute via Supabase Management API** - Use `SUPABASE_ACCESS_TOKEN` from `.env`

### Executing Migrations (Claude Code)

**NEVER tell the user to run migrations manually.** Use the Supabase Management API:

```bash
# Check for access token in .env
SUPABASE_ACCESS_TOKEN=<token>
NEXT_PUBLIC_SUPABASE_PROJECT_REF=<project-ref>

# Execute SQL via Management API
curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```

**DO NOT:**

- Tell user to copy SQL to dashboard manually
- Install database clients locally (pg, psql, etc.)
- Try direct database connections from Docker (DNS issues)

### Example: Adding a Column

```sql
-- Add to the appropriate table section in the monolithic file
ALTER TABLE user_encryption_keys
ADD COLUMN IF NOT EXISTS encryption_salt TEXT;
```

### Why Monolithic?

- Single source of truth for entire schema
- Can recreate database from scratch with one file
- No migration ordering issues
- Supabase Cloud doesn't support CLI migrations on free tier

**DO NOT:**

- Create files like `032_add_encryption_salt.sql`
- Suggest running SQL snippets piecemeal
- Use Supabase CLI migrations

## CI & E2E Stability (Round 10 Lessons, 2026-05-13)

The E2E suite ran against a single shared Supabase project for months and accumulated **9 rounds of "flake mitigation"** that all attacked symptoms. Round 10 (PR #89, commit `996211e`) finally identified the underlying root cause and fixed it structurally. These rules exist so future contributors don't re-derive the same painful path.

### THERE ARE NOW TWO E2E LANES (#575, 2026-08-14)

Most of the pain below traces to one fact — every job shared one cloud Supabase project. That is no longer where PRs run.

|                 | `e2e-local.yml`                              | `e2e.yml`                                      |
| --------------- | -------------------------------------------- | ---------------------------------------------- |
| backend         | a Supabase per runner, brought up in the job | the shared hosted project                      |
| runs on         | **every PR and every push to main**          | push/PR, currently blocked by the budget guard |
| secrets         | **none** — uses the tracked public demo keys | 32 `secrets.*` references                      |
| mutex           | none needed; nothing is shared               | repo-wide, `max-parallel: 2`                   |
| `@hosted` tests | excluded via `--grep-invert`                 | runs everything                                |

**A PR gets its E2E coverage from the local lane.** Consequences worth knowing before you debug anything:

- **The local lane cannot exhaust production quota**, cannot leak a service-role key, and two runs cannot race each other's cleanup. The #85 class is unreachable there rather than mitigated.
- **`e2e-local.yml` has NO `paths` filter, deliberately.** Filtering happens in its `changes` job, because a required check that never reports is **pending forever, not skipped** — the same reason `Build` and `Validate Component Structure` are absent from the required set. Never add a trigger path filter to it; `scripts/__tests__/e2e-local-triggers.test.js` fails if you do.
- **Its ignore list is derived from `e2e.yml`**, not duplicated (`scripts/ci/e2e-local-changes.mjs`). Two lists would drift silently, in the worst direction.
- **Six `oauth-csrf` tests are tagged `@hosted`** and skipped locally — they wait for a redirect to a real OAuth provider, which a local stack never performs. The #287 detector they carried is now covered on every PR by `auth-config-drift.yml` plus `tests/unit/auth-config-validity.test.ts` instead.
- **The lane is REQUIRED.** `E2E (local) result` became a required context once #739 closed (2026-08-15) — the `waitForUIStability` helper that waited three animation frames rather than for anything, duplicated across five messaging specs, was the thing gating it. A PR now cannot merge without this lane green.

The rules below still describe `e2e.yml` and remain correct for it.

### NEVER merge a PR while another PR's CI is running against the same backend

**Why**: this is what caused issue #85 to compound. Two concurrent E2E runs against the same Supabase project race each other's `cleanupOldMessages` `beforeAll` hooks across 11+ messaging specs. Each run wipes data the other run is polling for. One run hits the 60-min GitHub Actions job cap and gets cancelled.

**Now protected by**: `.github/workflows/e2e.yml` has a repo-wide `concurrency:` mutex (`group: e2e-supabase-${{ github.repository }}`, `cancel-in-progress: false`). Concurrent E2E runs queue; they never race. But the rule still applies to other shared backends in the future.

**Verification it's active**: trigger two pushes within 1 minute; the second workflow shows "Queued, waiting for another workflow run" in the Actions UI.

### Merging several PRs in quick succession can serve production with no CSS

**FIXED 2026-08-17 (#635). The mitigations below stay — read on for why.** Cloudflare
now fronts GitHub Pages and rewrites the cache headers at the edge:

```
document          cache-control: no-cache          (Response Header Transform Rule)
/_next/static/*   cache-control: max-age=31536000  (Cache Rule)
```

A visitor can no longer hold HTML pointing at deleted assets — the document revalidates
on every navigation. Verified live on `/`, `/blog/` and `/terms/`, each carrying `cf-ray`.

**Why it happened**: GitHub Pages serves HTML with `cache-control: max-age=600` and
cannot be told otherwise, while every deploy deletes the previous build's content-hashed
CSS and JS. A returning visitor could therefore hold HTML whose stylesheets no longer
exist — a white page, no nav, the logo at its natural size, with a perfectly correct DOM.
Reported from production **eight times** (#438, #467, #476, #548, #650, and three more
through 2026-08-15).

**Do NOT try to do the HTML half with a Cache Rule.** Browser TTL only ever _raises_ the
value: `override_origin` will not lower it below the origin's own `max-age`, and it
ignores such values with **no API error** — the rule saves, reads back exactly as
written, and does nothing. Measured on this zone against the origin's 600: `0`, `1` and
`300` were silently dropped; `700` and `12345` applied. The header must be set by a
**Response Header Transform Rule** (`http_response_headers_transform`, action `rewrite`),
which needs `Zone / Transform Rules / Edit` on the token.

**Cloudflare ruleset edits take ~45 seconds to propagate.** A probe fired straight after
a `PUT` reads the _previous_ rule and produces confident, wrong conclusions — three of
them in one session. Wait, then measure, and keep a control you know works.

**HTML cached by browsers BEFORE 2026-08-17 is still out there** and this change cannot
reach it. That is precisely why every mitigation below stays until it ages out.

**The window is measured in DAYS, and getting that unit wrong is the recurring bug.**
`scripts/retain-previous-assets.mjs` carries old assets forward, bounded by `RETAIN_DAYS`
(14) in `deploy.yml`. It was previously bounded by a deploy count, and that was mis-sized
twice — 5 (against the 10-minute cache window) and then 30 (against an assumed merge
rate, which turned out to be 40 deploys in 6 days, so ~3.5 days). **Never restate this
window in deploys**: converting requires a merge rate nobody measures, and
`retain-previous-assets.test.js` now fails if `RETAIN_GENERATIONS` reappears (#751).

**The trap is that docs-only PRs feel free.** `e2e.yml` has `paths-ignore` for
`**/*.md`, `docs/**` and `.gitignore`, so markdown PRs skip the ~1-hour E2E mutex that
paces everything else — and nothing else paces them. That is exactly how six merges
landed in half an hour.

**Guarded by four things, which check different questions:**

- `scripts/ci/check-cache-headers.mjs` (post-deploy `smoke.yml`) asserts against LIVE
  production that documents revalidate, hashed assets are cached a year, and `cf-ray` is
  present so the edge answered. **This is the only check that can see the cure**, because
  the Cloudflare rules live in a dashboard rather than this repo — delete one, rotate the
  token or move the zone and production silently returns to `max-age=600`. Note
  `check-stale-html.mjs` canNOT cover that: it serves itself over `127.0.0.1` with a
  hardcoded `max-age=600` and never touches the live site.

- `scripts/check-stale-html.mjs` (required `accessibility` check) drives A → B → C in a
  real chromium and asserts a visitor holding A's HTML is still styled after two deploys,
  with a negative control that fails if the harness stops simulating a deploy. It also
  proves `StylesheetGuard` fires, stays inert on a healthy page, and re-arms after an hour
  but not immediately (#752).
- `scripts/ci/check-retained-assets.mjs` (post-deploy `smoke.yml`) reads the live ledger
  and asserts both that every promised file is served **and that the window is still as
  wide as `RETAIN_DAYS`**. The second assertion exists because the first was green on the
  night production went unstyled for the eighth time.
- `scripts/__tests__/*` via `pnpm test:scripts` for the chaining, the window and the unit.

**The client-side backstop**: `StylesheetGuard` (in every page) detects a page whose
same-origin stylesheets all have zero rules and re-fetches at a fresh URL. It is the only
recovery that does not depend on a number being right — but it ships _inside_ the HTML,
so a document cached before it existed has no guard at all.

**Still worth pacing merges** — but the cause is gone as of #635, not merely mitigated.
Retiring `RETAIN_DAYS`, `StylesheetGuard`, #751 or #752 is a **separate, later** decision:
they are the only protection for HTML that entered a browser cache before 2026-08-17, and
removing them in the same breath as the fix would leave nothing if the edge rules were
ever lost. Retire them once real deploys have run under the new headers, and only with
`check-cache-headers.mjs` green in `smoke.yml`.

### NEVER bypass commit hooks (no `--no-verify`)

**Why**: husky + lint-staged + gitleaks all run pre-commit and catch real bugs. Yesterday's session almost shipped secrets in a doc PR; gitleaks caught it. The user explicitly forbids `--no-verify` unless they ask for it.

**If a hook fails**: investigate. Hook output names the file + line. Fix the underlying issue, re-stage, commit. Never `git commit --no-verify` as an escape hatch.

### Concurrent checkout safety

The checkout, Docker Compose project, generated artifacts, and Git `HEAD` are shared
state. Two agents can edit completely different files and still destroy each other's work
by switching branches or running a production build.

#### Prefer a sibling worktree for parallel implementation

- Create one worktree per task and branch. Do not switch the primary checkout while another
  agent may be using it.
- **Never copy `.env` verbatim into a worktree.** Use a separately provisioned local
  configuration with a unique `COMPOSE_PROJECT_NAME` (and a non-conflicting `SH_PORT`)
  before running Docker. The project name namespaces the ordinary Compose volumes.
- Compose isolation does **not** make concurrent local Supabase profiles safe: that profile
  has fixed default host ports and a global container name. Run it only with explicit
  coordination.
- Docker-first still applies to dependencies, tests, and builds. A worktree's `.git` is a
  pointer outside Compose's bind mount, however, so Git cannot commit from inside the
  container. Commit from the host in that case. Until #672 fixes worktree hooks, Husky will
  not run there; explicitly run and report the equivalent focused test, staged formatting or
  lint, and gitleaks check before committing. Never use `--no-verify` to hide a failure.

#### If a shared checkout is unavoidable

- Announce that you are taking the tree, and announce when you release it. Before
  `checkout`, `switch`, or `rebase`, require a clean `git status` and confirmation that
  no peer is holding `HEAD` or unpushed edits.
- Run only one production build or pre-push validation at a time. Builds write generated
  files into the bind-mounted tree even when their `.next` volume is isolated.
- Before moving `HEAD` after a peer finishes, verify their branch reached the remote:
  compare its local ref with `git ls-remote origin refs/heads/<branch>`.
- Keep the existing production deploy pacing: wait at least 10 minutes between merges.

### Programmatic `el.scrollTop = N` does NOT fire scroll events reliably in WebKit

**Why this matters**: Chromium and Firefox auto-fire the `scroll` event when JavaScript assigns to `scrollTop`. WebKit (Playwright's Linux build) does not always do this. Yesterday's `messaging-scroll.spec.ts:261` test ("T007-T008: Jump button appears when scrolled") failed all 3 retries on webkit-msg because the React `handleScroll` listener at `src/components/molecular/MessageThread/MessageThread.tsx:194` never ran.

**The fix pattern** (now applied at 4 sites in `tests/e2e/messaging/`):

```typescript
await el.evaluate((el) => {
  el.scrollTop = N;
  el.dispatchEvent(new Event('scroll', { bubbles: true })); // <-- explicit dispatch for WebKit
});
```

Apply this any time test code sets `scrollTop` and expects a scroll-event-driven UI side effect.

### Branch hygiene — NON-NEGOTIABLE

- **`delete_branch_on_merge=true`** is set on the repo. Every merged PR auto-deletes its head branch. Don't undo this.
- **After merging**, always `git fetch --prune origin` to drop the dead remote-tracking ref locally.
- **Never leave unmerged branches or open PRs sitting around** between work items. Merge or close one before starting the next.
- **Avoid stacked PRs** unless dependency is unavoidable. When a parent PR merges with `delete_branch_on_merge=true`, GitHub auto-closes any child PR using that parent as its base (known footgun — happened to PR #87 yesterday). Re-target the child to `main` and reopen.

### Environment guards have a direction

Before adding a `NODE_ENV`, hostname, or `localhost` guard, state which direction it
has:

- A **dev-only convenience**—for example verbose logging, an overlay, or extra error
  detail—may be limited to development.
- A **protection**—for example keeping a service worker out of framework router traffic—must
  protect production too. Never narrow it to development or `localhost`; that makes the
  user-facing environment the exceptional unprotected case.

#450 was this exact service-worker failure: the router bypass applied only on localhost, so
production was the only host where a failed worker fetch could break navigation. If a second
protection-shaped environment guard appears, re-audit the pattern and consider a lint rule.

### CI logs API ≠ UI

- **Authoritative state**: `gh run view <id> --json status,conclusion,jobs` or REST API
- **UI is misleading**: the workflow-run-list page shows the workflow's _overall_ status with the most-recent activity timestamp. That timestamp is when the _last queued sub-job started_, not when the run as a whole started. Reading "In progress 10:35 PM" as "nothing started yet" is wrong but easy to do.
- **For per-job status**: click into the run itself (job-graph view) or use the API. Don't trust the list page.

## Issue Hygiene: the body is the finding

**The issue BODY is the finding. A comment is not.**

The body is always-current truth and gets rewritten as things change. Comments are history — what someone said, and when. **If a comment is load-bearing, it belongs in the body and the comment should go.** A comment on issue 42 is the file nobody opens, wearing a different hat.

This is not a filing preference. It has cost real time here: a retraction posted as a comment on #391 left the issue **title** still asserting the thing being retracted, and the roadmap went on telling people to ignore a test that was not actually failing. Adopted repo-wide in #358 after a consolidation pass found four issues whose comments contradicted their own bodies.

**When you write something down, ask where a reader will look for it.** Then put it there.

- **Rewrite the body** — don't append. Put whatever changes the reader's mind at the top.
- **Watch the title too.** A stale title is read far more often than a body, and vastly more than a comment.
- **Comments worth keeping** are genuine history: someone else's words, or a delivery mechanism. Two live exemptions, both documented in the issues themselves — **#115**, the session-prime roadmap, whose comments _are_ the audit trail by design, and **#188**, whose retained comment is the paste-ready verification prompt that `docs/verification/schlajo-tickets.md` depends on.
- **Log before you fix.** A small fix still gets an issue. A change with no ticket behind it is one nobody can explain in three months.
- **A PR body and a commit message are history too — the same trap as a comment, one level further from the reader.** They describe one change at one moment. Nobody greps merged PRs to learn how the system works today. If a finding will still matter after the PR merges, it goes in an **issue body** and the PR points at it. Written after a session put four real findings — a markdown renderer that cannot draw tables (#421), a badge with no data behind it (#422), and two superseded recommendations — into PR bodies and commit messages, where the next reader would never have looked.
- **A PR that finishes a ticket says `Closes #N`, not `Refs #N`.** `Refs` merges the work and leaves the ticket open forever: #381, #382 and #383 all sat open behind their own merged PR because of it, reading as pending work that was already shipped. Use `Refs` only when the PR genuinely does not finish the ticket.

### `gh` traps when doing this

- **Comment IDs: `gh issue view` returns GraphQL node IDs** (`IC_kwDO…`), but the delete endpoint wants REST **numeric** IDs. Get them from `gh api /repos/OWNER/REPO/issues/N/comments --jq '.[].id'`, or the delete 404s.
- **`gh pr edit` is broken in this repo (#397).** It queries the deprecated Projects-classic `repository.pullRequest.projectCards` field and fails on every PR edit. The error reads like a deprecation _notice_, so in a script it looks like an unrelated failure. Use REST instead — note `-F` reads `@file`, `-f` would set the literal string:

  ```bash
  gh api -X PATCH repos/OWNER/REPO/pulls/N -F body=@body.md
  ```

  `gh issue edit` is unaffected. Re-test after a `gh` upgrade; when the CLI stops requesting `projectCards` this note can go.

- **Assert your anchor before pushing a body.** A patch that silently fails to match leaves an orphaned marker or drops an edit, and `&&` on the `gh` call will not catch it — the assertion has to live inside the script that rewrites the text. Grep the new body for a distinctive phrase from each comment **before** deleting that comment.

## Verify against the condition that fails, not the one that's convenient

Nearly every defect found in the 2026-07-28 visual-refresh session had the same shape: something was checked where it passed, then used where it didn't. This is the general rule; the specifics below are the ways it shows up here.

**A probe that cannot report failure proves nothing.** Four written in one session were wrong: one parsed `oklch()` from `getComputedStyle` as RGB (it returns `oklch()` unchanged — read colours back through a `<canvas>`), one printed its success line unconditionally, one was piped through `tail` and silently lost rows, one let Playwright's evaluate-retry double-fire `axe.run()`. Each was caught by a number that looked impossible, not by the tool saying so. **Make it fail on purpose before trusting a pass.**

### Gates are only as wide as what they point at

A green check means "the thing the gate looks at is fine", which is rarely what people read it as.

- **`tests/e2e/color-contrast.spec.ts` enumerates routes from `src/app/**/page.tsx`** — it used to be a hand-written list of four, which is how a 6.44:1 eyebrow reached `main` with 17 green checks (#411). Exclusions are printed every run with a reason. Don't replace the enumeration with a list.
- **Class-name selectors have a silent dependency on that class.** Introducing `.sh-btn` alongside DaisyUI's `.btn` dropped `mobile-touch-targets.spec.ts` from 6 measured targets to 5 — the buttons hadn't shrunk, they'd stopped being looked at. Only the **coverage floor** caught it. Never lower a floor to make a run pass (#396).
- **`hidden lg:block` hides a control from every gate you have.** Most specs run at 390px, so a desktop-only control is unmeasured everywhere. A 40px `ColorblindToggle` trigger sat in the nav that way indefinitely.

### Accessible names are an API — in both directions

Renaming one breaks locators: `32 Themes` → `34 Themes` broke seven across three specs (#408). **Adding** one is just as dangerous — a nav trigger labelled `"Demos menu"` matched `mobile-navigation`'s `[aria-label*="menu" i]`, came first in document order, and shadowed the mobile hamburger (#378).

Before naming a control, grep `tests/e2e` for **substring** collisions, and prefer the shortest honest name — `aria-haspopup` already makes a screen reader say "menu button". `.first()` follows document order, and nav markup precedes page content.

### Theme colours must clear contrast on every surface they sit on

`--color-*` values were AAA-verified against `base-100` only, and the annotations said so truthfully — but text also sits on `base-200`, where all seven light-theme colours measured 6.4–6.5:1 against a 7:1 gate. DaisyUI also dims `.label` and `.table th`, which is every form and every table in the product. Both are corrected in `globals.css`; check any new token on **base-100 and base-200**.

### Generated artifacts are build OUTPUTS, never inputs

`prebuild` writes `public/wireframes/`, sitemap, RSS and more. Importing one type-checks locally and fails CI on a fresh checkout. Read the committed source instead — for wireframes that's `features/<cat>/<feat>/wireframes/*.svg`, top level only.

**Two of them are tracked ON PURPOSE, and each has a test that makes that safe (#392):**

| artifact               | tracked | why, and what pins it                                                                                                                                                                                        |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public/manifest.json` | yes     | Reviewable: a `DISABLE_BASE_PATH=true` build rewrites `start_url`, `scope` and every icon path, and committing that breaks PWA install on Pages. `scripts/__tests__/generated-manifest.test.js` fails on it. |
| `public/robots.txt`    | yes     | Same shape (#504): the generator falls back to a `github.io` origin without `NEXT_PUBLIC_DEPLOY_URL`. `scripts/__tests__/canonical-artifacts.test.js` fails on it.                                           |

Everything else generated is gitignored — including `src/config/author-generated.ts`, which is
built from **your** `.env` and used to be committed, so every fork shipped one person's name,
avatar and five social URLs until they ran a build.

**A `.gitignore` rule for an already-tracked file does nothing**, and `git check-ignore` will
tell you it is "not ignored" because it is index-aware. Only `git check-ignore --no-index`
reveals the rule exists. `public/manifest.json` sat like that for months — ignored on paper,
tracked in fact. If you intend to untrack something, `git rm --cached` is the actual change.

### Read designs from the render, not from stripped text

`docs/design/2a/` holds the real design plus `renders/*.png`. Pulling copy out with a tag-stripping regex deletes every `<img>` and every `style` attribute — which is how the home page shipped with no logo and no gradients, twice. **Look at the PNG first**, then read the markup for exact values.

## `main` is protected

Direct pushes are rejected for everyone, admins included (#414). Work on a branch and open a PR — there is no other route in.

Required checks are **`Test (20.x)`, `accessibility`, `E2E (local) result`, `Conformance result`, `Component Structure result`, `Auth Config Drift result`, and `Signup Mailer result`** — seven, as of 2026-08-21 (#572). Every one comes from a workflow with no trigger `paths:` filter, which is what makes them safe to require.

`E2E (local) result` joined them when #739 closed. It is safe to require for the same reason: `e2e-local.yml` has no trigger `paths` filter, filtering happens in its `changes` job, and the aggregate reports green when nothing ran (see the two-lanes section above).

Requiring `Build` or the raw `Validate Component Structure` job would still make every docs-only PR permanently unmergeable: a required check that never reports is _pending forever_, not skipped. **Note the distinction that makes the four additions safe** — `Component Structure result` is the always-reporting aggregate, not the `Validate Component Structure` job it wraps. The job skips on unrelated changes; the aggregate runs `if: always()` and reports green when the job was legitimately skipped. Same for the other three. The sharded E2E jobs stay excluded too — their names carry the shard count (`E2E (chromium-gen 3/6)`), so changing the matrix would orphan every required context.

**`scripts/__tests__/required-checks-documented.test.js` fails when this list and branch protection disagree** (#782). This passage said "two" for two days after the third was added, which made a legitimate merge refusal — "the base branch policy prohibits the merge", while both documented checks were green — read as a broken protection rule.

To lift it: `gh api -X DELETE repos/TortoiseWolfe/ScriptHammer/branches/main/protection`.

## Important Notes

- Never create components manually - use the generator
- All PRs must pass component structure validation
- **E2E runs in CI on TWO lanes** — `e2e-local.yml` (a Supabase per runner, every PR, no secrets) and `e2e.yml` (the shared hosted project). 24 jobs each. See "THERE ARE NOW TWO E2E LANES" above before debugging either
- Docker-first development is mandatory
- Use `min-h-11 min-w-11` for 44px touch targets (mobile-first)

---

## Planning Factory (Multi-Terminal Workflow)

This repo also contains the planning factory tooling from the ScriptHammer planning template. The sections below govern the multi-terminal spec-driven workflow.

### Multi-Terminal Assembly Line

Claude Code terminals in a tmux session arranged in assembly line order:

```
STRATEGY:    CTO → ProductOwner → BusinessAnalyst
DESIGN:      Architect → UXDesigner → UIDesigner
CODE:        Developer → Toolsmith → Security
TEST:        TestEngineer → QALead → Auditor
DOCS:        Author → TechWriter
RELEASE:     DevOps → DockerCaptain → ReleaseManager → Coordinator
```

Wireframe work has been consolidated onto the SpecKit `/speckit.wireframe.*`
skills — the dedicated 6-role wireframe tmux pipeline was retired and
absorbed into the Developer / UIDesigner terminals' normal workflow.

See `.claude/roles/` for role-specific context:

| File                | Roles                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `operator.md`       | Operator (runs outside tmux)                                          |
| `council.md`        | CTO, ProductOwner, Architect, UXDesigner, Toolsmith, Security, DevOps |
| `design.md`         | UIDesigner                                                            |
| `implementation.md` | Developer, TestEngineer, QALead, Auditor                              |
| `support.md`        | Author, TechWriter, BusinessAnalyst, Coordinator                      |
| `release.md`        | DevOps, DockerCaptain, ReleaseManager                                 |
| `stw-liaison.md`    | StW-Liaison (client operator for SpokeToWork)                         |

### Terminal Git Rules (delegated tmux workflows)

When an Operator has explicitly assigned a terminal-only tmux workflow:

- **COMMIT ONLY, NEVER PUSH** — the assigned Operator owns pushing
- Stay in your lane: commit your work and move on

This is a delegated-workflow exception, not the normal repository rule. In ordinary
individual or worktree work, the branch author pushes from the host after the required
checks and follows **Concurrent checkout safety** above.

### Feature Specs & Wireframes

- `features/<category>/<NNN-name>/` — feature specifications (spec.md, plan.md, tasks.md, checklist.md) + per-feature `wireframes/` subdir with SVGs and shared chrome
- `features/IMPLEMENTATION_ORDER.md` — dependency graph + tier ordering
- `.claude/inventories/` — codebase inventory snapshots (run `/refresh-inventories` after spec changes)
- `/wireframes` Next.js route iframes the manifest-driven viewer (auto-discovers all SVGs; build-synced by `scripts/sync-wireframes.sh`)

### SVG Wireframe Rules

- Canvas: `viewBox="0 0 1920 1080" width="1920" height="1080"`
- Desktop: x=40, y=60, 1280×720 | Mobile: x=1360, y=60, 360×720
- Panel color: `#e8d4b8` (never white)
- Touch targets: 44px minimum
- Machine validation: `.specify/extensions/wireframe/scripts/validate.py`

### Fork Guide

After forking ScriptHammer:

1. Run `/refresh-inventories` — Regenerates context files for your specs
2. Update `.claude/inventories/` — Reflects your project's features
3. Modify `features/IMPLEMENTATION_ORDER.md` — Your dependency sequence

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
