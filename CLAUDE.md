# CLAUDE.md — chattanooga-mini

ScriptHammer fork: Next.js 15 / React 19 / Tailwind 4 / DaisyUI / Supabase / PWA, static-exported to GitHub Pages.

Workspace conventions (Docker-first mandate, 5-file component pattern + `generate:component`, SpecKit command flow, testing stack, deployment, code quality) live in `/home/TurtleWolfe/repos/CLAUDE.md`.

## Safety & permissions

- **COMMIT ONLY, NEVER PUSH** when acting as a multi-terminal role — only the Operator has SSH push access. Stay in your lane.
- **Never bypass commit hooks** (no `git commit --no-verify`) unless the user asks — husky + lint-staged + gitleaks catch real bugs and secrets. If a hook fails, fix the named file/line and re-commit.
- **Never merge a PR while another PR's CI is running against the same shared Supabase backend** — concurrent E2E runs race each other's cleanup hooks and wipe each other's data. (`.github/workflows/e2e.yml` has a repo-wide `concurrency:` mutex, `cancel-in-progress: false`; the rule still applies to any other shared backend.)
- **Static hosting (GitHub Pages):** no server-side API routes in production (`src/app/api/` won't run), and non-`NEXT_PUBLIC_*` env vars aren't available in the browser. Put server logic and secrets in Supabase (Vault, Edge Functions, triggers) — never in the client bundle.
- **Branch hygiene:** `delete_branch_on_merge=true` is set — don't undo it. `git fetch --prune origin` after merges. Avoid stacked PRs: when a parent PR merges, GitHub auto-closes children based on it — re-target the child to `main` and reopen.

## Supabase migrations (destructive — read before touching schema)

- **One monolithic migration file:** `supabase/migrations/20251006_complete_monolithic_setup.sql`. NEVER create separate/numbered migration files and never use Supabase CLI migrations (Cloud free tier doesn't support them).
- Edit that file directly; keep every statement idempotent (`IF NOT EXISTS`) inside the existing `BEGIN;`…`COMMIT;`.
- Execute via the Supabase Management API with `SUPABASE_ACCESS_TOKEN` + `NEXT_PUBLIC_SUPABASE_PROJECT_REF` from `.env` (`POST https://api.supabase.com/v1/projects/{ref}/database/query`). Never tell the user to paste SQL into the dashboard, never install psql/pg locally, never open direct DB connections from Docker (DNS fails).

## Non-derivable facts & gotchas

- **Docker service name is `scripthammer`; dev server is pinned to port 3000.** All commands run in the container: `docker compose exec scripthammer pnpm …`.
- **Commit from inside the container** (`docker compose exec scripthammer git commit …`) — host commits fail the Docker-installed hooks. `git push` from the host (uses your SSH keys).
- **Supabase free tier auto-pauses after ~7 days / inactivity** (first request then takes 10–30s). Wake it: `docker compose exec scripthammer pnpm run prime`.
- **Tailwind stops loading if Leaflet CSS is imported in `globals.css`** — import Leaflet CSS only inside map components; restart the container after CSS changes.
- **WebKit doesn't fire `scroll` events on `el.scrollTop = N` assignment** (Playwright's Linux build; Chromium/Firefox do). In tests expecting a scroll-driven UI effect, dispatch it explicitly: `el.dispatchEvent(new Event('scroll', { bubbles: true }))`.
- **Test user:** `test@example.com` / `TestPassword123!` (secondary via `TEST_USER_SECONDARY_*` in `.env`).
- **SVG wireframes:** `viewBox="0 0 1920 1080"`, panel color `#e8d4b8` (never white), 44px touch targets (`min-h-11 min-w-11`); validate with `.specify/extensions/wireframe/scripts/validate.py`.

## Pointers

- CI/CD deploy secrets (`NEXT_PUBLIC_SUPABASE_*`, GA, PageSpeed, author fields): see **README.md** → Settings → Secrets and variables → Actions.
- Feature docs live under `docs/` (auth, messaging, payments, security, testing, forking, component creation).
- Multi-terminal roles: `.claude/roles/`. Feature specs/wireframes: `features/<category>/<NNN-name>/`; dependency order in `features/IMPLEMENTATION_ORDER.md`; inventories in `.claude/inventories/` (refresh with `/refresh-inventories`).
