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
| **Cleanup** | Deletes `public/CNAME` (unless custom domain detected)                                                 |

### Script Options

```bash
# Preview changes (no modifications)
./scripts/rebrand.sh MyProject myuser "Description" --dry-run

# Skip all prompts
./scripts/rebrand.sh MyProject myuser "Description" --force

# Keep CNAME file
./scripts/rebrand.sh MyProject myuser "Description" --keep-cname

# Combine options
./scripts/rebrand.sh MyProject myuser "Description" --dry-run --force
```

### Exit Codes

| Code | Meaning                  |
| ---- | ------------------------ |
| 0    | Success                  |
| 1    | Invalid arguments        |
| 2    | User declined re-rebrand |
| 3    | Git error                |

## GitHub Pages Deployment

### Enable GitHub Pages

1. Go to your repository **Settings → Pages**
2. Under "Build and deployment", select **GitHub Actions** as source
3. Push to `main` branch to trigger deployment

### Required Secrets

Add these secrets in **Settings → Secrets and variables → Actions → Repository secrets**:

#### Minimal (Required)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_PAGESPEED_API_KEY=your-google-api-key
```

#### Recommended

```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_AUTHOR_NAME=Your Name
NEXT_PUBLIC_AUTHOR_EMAIL=your@email.com
```

See `.env.example` for the complete list of available secrets.

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

Tests should pass without Supabase environment variables thanks to comprehensive mocks in `tests/setup.ts`. If tests fail:

1. Ensure you have the latest version of the template
2. Check that no test is directly importing from `@supabase/supabase-js`

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

## Getting Help

- **GitHub Issues**: [ScriptHammer Issues](https://github.com/TortoiseWolfe/ScriptHammer/issues)
- **Documentation**: [CLAUDE.md](../CLAUDE.md) for comprehensive development guide
