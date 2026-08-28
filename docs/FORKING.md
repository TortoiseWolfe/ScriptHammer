# Forking ScriptHammer

Complete guide to creating your own project from the ScriptHammer template.

## Quick Start (about 11 minutes)

Measured by forking this template for real — the fork times on 2026-08-21, the rebrand
figures re-measured on 2026-08-27. `rebrand.sh` is 15 seconds and rewrites 928 files; the
rest is the cold Docker build. Add roughly another 17 minutes to reach a green build and
test suite. Going live on your own domain is longer and mostly third-party — see
[FORK-CHECKLIST.md](FORK-CHECKLIST.md).

```bash
# 1. Fork and clone
gh repo fork TortoiseWolfe/ScriptHammer --clone
cd YourProjectName

# 2. Run the rebrand script. It refuses without an icon decision -- see "Your brand
#    mark is not covered by any of that" below. Use --no-icon if you have no mark yet.
./scripts/rebrand.sh MyProject myusername "My awesome project description" --icon path/to/mark.svg

# 3. Create environment file
cp .env.example .env
# macOS/Linux: .env will hold service and payment credentials; make it owner-only now.
chmod 600 .env
# Edit .env - set UID and GID (run: id -u && id -g)

# 4. Start Docker
docker compose up -d

# 5. Verify build
docker compose run --rm builder pnpm run build

# 6. Run tests
docker compose exec myproject pnpm test

# 7. Commit and push
docker compose exec myproject git add -A
docker compose exec myproject git commit -m "Rebrand to MyProject"
git push
```

## What the Rebrand Script Does

The `scripts/rebrand.sh` script automates updating 928 files:

| Category  | Changes                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| **Code**  | Replaces every ASCII case style of "ScriptHammer" across tracked text, while keeping prose and identifiers valid |
| **Paths** | Renames brand-bearing files and directories from one collision-checked plan; binary bytes are never rewritten    |

### Your brand mark is not covered by any of that

A rebrand substitutes strings, and **a logo is not a string**. Nothing in the
table above looks at an image, so without a mark of your own every browser tab
and every home-screen install shows ScriptHammer's icon.

This is not a hypothetical: it has reached production twice, on two different
live sites, the second time straight past a warning added to prevent the first.
So `rebrand.sh` now **refuses to run** until you decide:

```bash
# You have a mark — .svg, .png and .webp all work
./scripts/rebrand.sh "MyApp" myuser "My description" --icon path/to/mark.svg

# You do not have one yet, and you are choosing to ship ours for now
./scripts/rebrand.sh "MyApp" myuser "My description" --no-icon
```

`--icon` regenerates the whole set — favicon, the eight PWA sizes, the maskable
variants, `apple-touch-icon`, and `favicon.ico` — from your single mark. Use a
**symbol rather than a wordmark**: `favicon.ico` carries a **16px** frame, which is
what a standard-DPI browser tab shows, and 16px is 256 pixels in total.

That advice used to say 32px. It was correct and insufficient (#906): a mark can read
cleanly at 32 and be an indistinct smudge at 16. The failure is predictable rather than
mysterious — **interior text, hairline strokes, facet edges, or more than about three
tonal areas** are more detail than 256 pixels can carry. Measured on a real fork's mark,
a faceted die with a thin outline and an interior numeral: clean at 48, readable at 32,
and at 16 neither the shape nor the numeral survived.

Nothing can check this for you. `pnpm check:icons` asserts the icons match your mark; it
cannot assert your mark was suitable. Open `public/favicon.ico` at 100% and look, or
accept the smudge knowingly.

If your mark genuinely needs its detail, pass a second, simplified one:

```bash
./scripts/rebrand.sh MyProject myuser "Description" --icon mark.svg --icon-small mark-16.svg
```

`--icon-small` is used for everything at or below 32px — the two small `favicon.ico`
frames and `icon.svg` — while the main mark keeps 48px and up. It is copied to
`public/favicon-small.*`, so `pnpm check:icons` and later `generate:icons` runs pick it
up on their own.

If you take `--no-icon`, the icons stay ScriptHammer's until you run
`pnpm run generate:icons` with your own mark. `pnpm run check:icons` tells you
whether the committed set still matches it.
| **Docker** | Updates service name in `docker-compose.yml` |
| **Git** | Updates remote origin URL to your repository |
| **Config** | Updates `package.json` name, description, and repository fields |
| **Themes** | Renames `scripthammer-dark`/`scripthammer-light` theme blocks to your project name |
| **Env** | Updates `COMPOSE_PROJECT_NAME` and example commands in `.env.example` |
| **CNAME** | **Deletes** `public/CNAME` — a fork has no custom domain yet, and the file's presence drops the Pages basePath (unless a real custom domain is already set, or `--keep-cname`) |
| **Blog** | **Removes the template's posts**, keeping only the `hello-world` exemplar, and filters `src/lib/blog/blog-data.json` to match (unless `--keep-blog`) — see below |

### Script Options

```bash
# Every invocation needs --icon or --no-icon. These examples use --icon; swap in
# --no-icon if you have no mark yet.

# Preview changes (no modifications)
./scripts/rebrand.sh MyProject myuser "Description" --icon mark.svg --dry-run

# Skip all prompts
./scripts/rebrand.sh MyProject myuser "Description" --icon mark.svg --force

# Keep public/CNAME exactly as it is. NOTE: on a fresh fork that file contains
# ScriptHammer's own domain, so this is only right if you have already replaced it.
./scripts/rebrand.sh MyProject myuser "Description" --icon mark.svg --keep-cname

# Preserve SSH format for git remote (if your origin is SSH)
./scripts/rebrand.sh MyProject myuser "Description" --icon mark.svg --preserve-ssh

# Combine options
./scripts/rebrand.sh MyProject myuser "Description" --no-icon --dry-run --preserve-ssh
```

| Option                   | Description                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `--dry-run`              | Preview changes without modifying files                                                            |
| `--force`                | Skip all confirmation prompts                                                                      |
| `--keep-cname`           | Don't update `public/CNAME` file (keep existing domain)                                            |
| `--keep-blog`            | Keep the template's blog posts instead of removing them                                            |
| `--preserve-ssh`         | Keep SSH format (`git@github.com:`) if currently using SSH                                         |
| `--preserve-attribution` | **No-op.** Attribution is always kept — see below. Still parses, so scripts passing it don't break |

### The blog

A brand sweep is the wrong tool for writing. Left alone it rewrites `public/blog/*.md` like
any other file, so the template's posts come out with your name on them — public, indexed, in
your `sitemap.xml` and your RSS feed. That includes this project's personal essays and
`bad-seo-example.md`, a deliberate bad-SEO **test fixture** that would ship as a real post.
A real fork measured before this changed was republishing 15 of the template's 16 posts, and
its own introduction slug served a post titled "ScriptHammer — Opinionated Next.js PWA
Template".

So the rebrand removes them, keeping one `hello-world` post that documents the frontmatter
contract and tells you to delete it. `public/blog-images/<slug>/` goes with each removed post.
`public/blog/CLAUDE.md` stays — it is authoring guidance, not a post, and the generator's
ALL-CAPS exclusion is what distinguishes them.

**Both sides are cleared, and that is the point.** `src/app/blog/[slug]/page.tsx` renders out
of the committed index at `src/lib/blog/blog-data.json` and never reads the markdown, so
deleting the files alone would leave every post still being served, with no file left to edit.
The rebrand filters the index to match and recomputes its tag and category lists, so your blog
filters do not offer facets nothing is filed under.

The same asymmetry applies afterwards, whenever you write: **a post is not published until you
run `pnpm generate:blog` and commit the index.** See the fork checklist for the details.

### Keeping a string through a rebrand — `rebrand:keep`

Put `rebrand:keep` in a comment **on the same line** as any string that must
survive. The script skips that line in every replacement pass:

```ts
// src/config/footer-links.ts
href: 'https://github.com/TortoiseWolfe/ScriptHammer', // rebrand:keep
label: 'ScriptHammer', // rebrand:keep
```

Three things worth knowing:

- **It is line-scoped, not file-scoped.** A marker at the top of a file protects
  nothing below it.
- **The token is deliberately brand-neutral.** `scripthammer:keep` would contain
  the very string the second replacement pass searches for — a self-referential
  trap.
- **The attribution link uses this**, which is why `--preserve-attribution` is
  now a no-op. Before #513 the flag skipped any file matching `*Footer*`
  case-sensitively, and the attribution had moved to the lowercase
  `src/config/footer-links.ts` — so the one file the flag existed to protect was
  the one file it never matched. Every fork silently lost the link back,
  including forks whose owners would have kept it.

An applied rebrand ends with an independent, case-insensitive scan of eligible
tracked text (excluding lockfiles, binaries, and symlink targets) plus every
transformed path. Any old-brand survivor outside a
same-line `rebrand:keep` marker is an error, and the script does not print
`REBRAND COMPLETE`. Dry runs report proposed changes but do not apply that
postcondition to the intentionally unchanged tree.

Case style is intentional: `ScriptHammer` uses the display name,
`scripthammer` uses the technical slug, `Scripthammer` uses title case, and
`SCRIPTHAMMER` uses an uppercase identifier-safe component name. Thus a fork
named `GeoLarp` gets `GeoLarp`, `geolarp`, `Geolarp`, and `GEOLARP`; an env-style
`SCRIPTHAMMER_TEST_DOMAIN` becomes `GEOLARP_TEST_DOMAIN`. Arbitrary mixed forms
such as `ScriptHAMMER` are matched too.

The shell workflow and its case-mapping helper remain stable template tooling;
only the four recorded identity fields in `scripts/rebrand.sh` change after the
postcondition succeeds. Before a different-target re-rebrand, stage the prior
path moves with `git add -A` (preferably commit them). Automation refuses a
source identity whose projections are ambiguous, or one that collides with the
stable tooling, rather than risking a partial rewrite. Same-identity reruns are
still explicit no-ops.

**Removing the attribution is a one-line edit and you are welcome to make it.**
It is MIT. The default is "kept" so that losing it is a decision rather than an
accident.

### Exit Codes

| Code | Meaning                       |
| ---- | ----------------------------- |
| 0    | Success                       |
| 1    | Validation or rebrand failure |
| 2    | User declined re-rebrand      |
| 3    | Git error                     |

## Customizing Your Theme

The rebrand script renames the ScriptHammer theme blocks to your project name but keeps the same colors. To customize:

1. Edit `src/app/globals.css` — change the oklch color values in the `@plugin "daisyui/theme"` blocks
2. Run Storybook to preview: `docker compose exec <project> pnpm run storybook`
3. Use the theme switcher in the Storybook toolbar to verify both dark and light variants

See [CUSTOM-THEME.md](./CUSTOM-THEME.md) for the full guide including color format, WCAG contrast requirements, and all files that reference the theme.

## GitHub Pages Deployment

### Enable GitHub Pages

1. Go to your repository **Settings → Pages**
2. Under "Build and deployment", select **GitHub Actions** as source
3. Push to `main` branch to trigger deployment

### Required Secrets and Variables

Both live under **Settings → Secrets and variables → Actions**, on two different tabs, and
**the tab matters** — putting a value in the wrong one does not error, it arrives as an empty
string and the site builds without it.

#### Repository SECRETS — required, the deploy hard-fails without this one

```
NEXT_PUBLIC_PAGESPEED_API_KEY=your-google-api-key
```

`.github/workflows/deploy.yml` checks this before it runs the build and exits 1 if it is empty.
It is the single thing standing between your first push and any site existing. (It ships in the
client bundle either way, so it is a "secret" only by storage location.)

#### Repository VARIABLES — not secrets

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_DEPLOY_URL=https://yourdomain.com
```

`deploy.yml` reads all four from `vars.*`. Put the Supabase pair in Secrets and the deploy still
succeeds — with no backend in the bundle, and the setup banner on every page.

Set the two URLs even if you are not on a custom domain yet: `sitemap.xml` and `robots.txt` fall
back to a `github.io` origin without them, and the asset-retention step falls back to crawling
**this template's** site rather than yours.

#### Recommended for E2E Testing

These enable full E2E test coverage:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TEST_USER_PRIMARY_EMAIL=yourname+test-a@gmail.com
TEST_USER_PRIMARY_PASSWORD=TestPassword123!
TEST_USER_SECONDARY_EMAIL=yourname+test-b@gmail.com
TEST_USER_SECONDARY_PASSWORD=TestPassword456!
TEST_USER_TERTIARY_EMAIL=yourname+test-c@gmail.com
TEST_USER_TERTIARY_PASSWORD=TestPassword789!
TEST_EMAIL_DOMAIN=yourname+e2e@gmail.com
```

> **Important: Email Domain Requirements**
>
> Supabase Auth validates that email domains have valid MX (mail exchange) records.
> `@example.com` is a reserved domain and will **always be blocked**.
>
> **Use Gmail plus aliases** instead: `yourname+test@gmail.com`
>
> The plus alias format allows unlimited unique emails that all arrive at your
> inbox but Supabase treats each as a separate user.

#### Optional

```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_AUTHOR_NAME=Your Name
NEXT_PUBLIC_AUTHOR_EMAIL=your@email.com
```

See [README.md](../README.md#-github-actions-secrets) for the complete prioritized list of secrets.

### basePath Auto-Detection

The deployment automatically detects your repository name and sets the correct basePath for GitHub Pages. No `NEXT_PUBLIC_BASE_PATH` secret is required.

## Supabase Setup

While Supabase env vars are unset, you'll see a yellow "Setup required" banner on every page of the running app. This is intentional — it disappears automatically once `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are populated. The banner is also dismissible via the × button if you want to focus on non-Supabase features first.

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key from **Settings → API**

### 2. Add Environment Variables

```bash
# .env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Run Database Migrations

The project uses a monolithic migration file. To set up your database:

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20251006_complete_monolithic_setup.sql`
3. Run the SQL

### 4. Add GitHub Secrets

Add the same values as GitHub repository secrets for deployment.

## Docker Git Workflow

Git commits from inside the Docker container are fully supported:

```bash
# Set your git identity (add to .env)
GIT_AUTHOR_NAME=Your Name
GIT_AUTHOR_EMAIL=your@email.com

# Then commit from container
docker compose exec myproject git add -A
docker compose exec myproject git commit -m "Your commit message"
git push  # Push from host (SSH keys on host)
```

## Verification Checklist

After forking, verify everything works:

- [ ] `docker compose up` starts without errors
- [ ] `docker compose exec <project> pnpm test` — all tests pass
- [ ] `docker compose run --rm builder pnpm run build` — build succeeds
- [ ] No "ScriptHammer" references in `package.json`
- [ ] `git remote -v` shows your repository URL
- [ ] `.env` has `COMPOSE_PROJECT_NAME=<yourproject>` (not `scripthammer`)
- [ ] `.env` is owner-only (`chmod 600 .env`) before it contains credentials
- [ ] `public/CNAME` contains your domain — or is **absent**, which is correct until you own one. Its presence drops the Pages basePath, so a CNAME naming a domain you do not control 404s every asset.
- [ ] `docker compose ps` shows your project name in container names
- [ ] GitHub Pages deployment succeeds (if enabled)
- [ ] Site loads at `https://username.github.io/project-name/`

### Port Variables

The `SH_*` port environment variables (`SH_PORT`, `SH_STORYBOOK_PORT`, etc.) are inherited from the template and work as-is. They control host port bindings in `docker-compose.yml`. You can customize them in `.env` if you need fixed ports, but the defaults (ephemeral assignment) prevent collisions automatically.

## Troubleshooting

### Tests Fail Without Supabase

Unit tests should pass without Supabase environment variables thanks to comprehensive mocks in `tests/setup.ts`. If tests fail:

1. Ensure you have the latest version of the template
2. Check that no test is directly importing from `@supabase/supabase-js`

### E2E Tests Fail with "Invalid email" Errors

Supabase Auth validates email domains have MX records. Common causes:

1. **Using `@example.com`**: This reserved domain is always blocked
2. **Missing TEST_EMAIL_DOMAIN**: Set this env var to use Gmail plus aliases

**Fix**: Use Gmail plus alias format in your `.env`:

```bash
TEST_EMAIL_DOMAIN=yourname+e2e@gmail.com
TEST_USER_PRIMARY_EMAIL=yourname+test-a@gmail.com
```

### E2E Tests Create Multiple Users per Test

The `session-persistence.spec.ts` test previously created users in `beforeEach` instead of `beforeAll`, causing rate limits. This is fixed in the template but if you see rate limit errors:

1. Check that `beforeAll` is used for user creation (not `beforeEach`)
2. Use unique email prefixes via `generateTestEmail('unique-prefix')`

### Build Fails After Rebrand

1. Run `docker compose down && docker compose up --build` to rebuild
2. The script already fails on unmarked survivors. To inspect manually, use
   `git grep -Iin scripthammer` and confirm every remaining line carries `rebrand:keep`.
3. Ensure all import paths are correct after file renames

### GitHub Pages Shows 404

1. Verify GitHub Pages is enabled with "GitHub Actions" source
2. Check Actions tab for deployment errors
3. Wait a few minutes after deployment completes
4. Clear browser cache

### Permission Errors

Always use Docker commands, never `sudo`:

```bash
# Wrong
sudo rm -rf node_modules

# Correct
docker compose exec <project> rm -rf node_modules
```

## Syncing with Upstream (ScriptHammer)

Keep your fork updated with improvements from ScriptHammer:

### One-Time Setup

```bash
# Add ScriptHammer as upstream remote
git remote add upstream https://github.com/TortoiseWolfe/ScriptHammer.git

# Verify remotes
git remote -v
# origin    https://github.com/YOU/YOUR-PROJECT.git (fetch)
# upstream  https://github.com/TortoiseWolfe/ScriptHammer.git (fetch)
```

### Pulling Updates

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream into your main branch
git checkout main
git merge upstream/main

# Resolve any conflicts, then push
git push origin main
```

### Cherry-Picking Specific Commits

If you only want specific fixes:

```bash
# View upstream commits
git log upstream/main --oneline -20

# Cherry-pick specific commits
git cherry-pick <commit-hash>
```

### After Pulling Updates

1. Rebuild Docker: `docker compose down && docker compose up --build`
2. Run tests: `docker compose exec <project> pnpm test`
3. Check for new environment variables in `.env.example`

### If Merge Conflicts Are Too Complex

Open an issue with the conflicting paths on
[ScriptHammer Issues](https://github.com/TortoiseWolfe/ScriptHammer/issues). Upstream
changes that conflict badly for one fork usually conflict for others, so they are worth
reporting rather than working around alone.

## Getting Help

- **GitHub Issues**: [ScriptHammer Issues](https://github.com/TortoiseWolfe/ScriptHammer/issues)
- **Documentation**: [CLAUDE.md](../CLAUDE.md) for comprehensive development guide
