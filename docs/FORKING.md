# Forking ScriptHammer

Complete guide to creating your own project from the ScriptHammer template.

## Quick Start (5 Minutes)

```bash
# 1. Fork and clone
gh repo fork TortoiseWolfe/ScriptHammer --clone
cd YourProjectName

# 2. Run the rebrand script
./scripts/rebrand.sh MyProject myusername "My awesome project description"

# 3. Create environment file
cp .env.example .env
# Edit .env - set UID and GID (run: id -u && id -g)

# 4. Start Docker
docker compose up -d

# 5. Verify build
docker compose exec myproject pnpm run build

# 6. Run tests
docker compose exec myproject pnpm test

# 7. Commit and push
docker compose exec myproject git add -A
docker compose exec myproject git commit -m "Rebrand to MyProject"
git push
```

## What the Rebrand Script Does

The `scripts/rebrand.sh` script automates updating 200+ files:

| Category    | Changes                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| **Code**    | Replaces "ScriptHammer" with your project name in all TypeScript, JavaScript, JSON, and Markdown files |
| **Files**   | Renames files containing "ScriptHammer" (e.g., `ScriptHammerLogo.tsx` → `MyProjectLogo.tsx`)           |
| **Docker**  | Updates service name in `docker-compose.yml`                                                           |
| **Git**     | Updates remote origin URL to your repository                                                           |
| **Config**  | Updates `package.json` name, description, and repository fields                                        |
| **Themes**  | Renames `scripthammer-dark`/`scripthammer-light` theme blocks to your project name                     |
| **Cleanup** | Deletes `public/CNAME` (unless custom domain detected)                                                 |

### Script Options

```bash
# Preview changes (no modifications)
./scripts/rebrand.sh MyProject myuser "Description" --dry-run

# Skip all prompts
./scripts/rebrand.sh MyProject myuser "Description" --force

# Keep CNAME file
./scripts/rebrand.sh MyProject myuser "Description" --keep-cname

# Preserve SSH format for git remote (if your origin is SSH)
./scripts/rebrand.sh MyProject myuser "Description" --preserve-ssh

# Keep ScriptHammer attribution link in Footer component
./scripts/rebrand.sh MyProject myuser "Description" --preserve-attribution

# Combine options
./scripts/rebrand.sh MyProject myuser "Description" --dry-run --preserve-ssh --preserve-attribution
```

| Option                   | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `--dry-run`              | Preview changes without modifying files                    |
| `--force`                | Skip all confirmation prompts                              |
| `--keep-cname`           | Don't delete `public/CNAME` file                           |
| `--preserve-ssh`         | Keep SSH format (`git@github.com:`) if currently using SSH |
| `--preserve-attribution` | Skip Footer.tsx to keep ScriptHammer attribution link      |

### Exit Codes

| Code | Meaning                  |
| ---- | ------------------------ |
| 0    | Success                  |
| 1    | Invalid arguments        |
| 2    | User declined re-rebrand |
| 3    | Git error                |

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

### Required Secrets

Add these secrets in **Settings → Secrets and variables → Actions → Repository secrets**:

#### Required for CI/CD (Add These First)

These are **required** for the build and deployment workflows to succeed:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

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
NEXT_PUBLIC_PAGESPEED_API_KEY=your-google-api-key
```

See [README.md](../README.md#-github-actions-secrets) for the complete prioritized list of secrets.

### basePath Auto-Detection

The deployment automatically detects your repository name and sets the correct basePath for GitHub Pages. No `NEXT_PUBLIC_BASE_PATH` secret is required.

## Supabase Setup

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
- [ ] `docker compose exec <project> pnpm test` - all tests pass
- [ ] `docker compose exec <project> pnpm run build` - build succeeds
- [ ] No "ScriptHammer" references in `package.json`
- [ ] `git remote -v` shows your repository URL
- [ ] GitHub Pages deployment succeeds (if enabled)
- [ ] Site loads at `https://username.github.io/project-name/`

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
2. Check for any remaining "ScriptHammer" references: `grep -r "ScriptHammer" src/`
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

See [FORKING-FEEDBACK.md](./FORKING-FEEDBACK.md) for a changelog of fixes you can apply manually.

## Getting Help

- **GitHub Issues**: [ScriptHammer Issues](https://github.com/TortoiseWolfe/ScriptHammer/issues)
- **Documentation**: [CLAUDE.md](../CLAUDE.md) for comprehensive development guide
