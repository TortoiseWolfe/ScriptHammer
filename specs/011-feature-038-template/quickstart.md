# Quickstart: Template Fork Experience

## Developer Setup (After Feature Implementation)

### Fork Workflow (5 minutes)

```bash
# 1. Fork & Clone
gh repo fork TortoiseWolfe/ScriptHammer --clone
cd YourNewProject

# 2. Run Rebrand Script
./scripts/rebrand.sh MyApp myusername "My awesome application"

# 3. Create Environment File
cp .env.example .env
# Edit .env with your values (UID, GID from `id -u` and `id -g`)

# 4. Start Docker
docker compose up -d

# 5. Verify Build
docker compose exec myapp pnpm run build

# 6. Run Tests
docker compose exec myapp pnpm test

# 7. Commit & Push
docker compose exec myapp git add -A
docker compose exec myapp git commit -m "Rebrand to MyApp"
git push
```

### GitHub Pages Setup

1. Go to repository Settings → Pages
2. Source: "GitHub Actions"
3. Add repository secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Push to trigger deployment

### Verification Checklist

- [ ] `pnpm test` passes (no Supabase errors)
- [ ] `pnpm run build` succeeds
- [ ] Docker container starts without errors
- [ ] No "ScriptHammer" references in `package.json`
- [ ] Git remote points to your repository
- [ ] GitHub Pages deployment succeeds

## Implementation Verification

### Testing Rebrand Script

```bash
# Dry run first
./scripts/rebrand.sh TestProject testuser "Test description" --dry-run

# Check output shows expected changes
# Then run for real
./scripts/rebrand.sh TestProject testuser "Test description"

# Verify no ScriptHammer references remain
grep -r "ScriptHammer" --include="*.ts" --include="*.tsx" --include="*.json" .
# Should return empty
```

### Testing Supabase Mock

```bash
# Remove env vars temporarily
mv .env .env.backup

# Run tests
docker compose exec scripthammer pnpm test

# Should pass with mocked Supabase client
# Restore env
mv .env.backup .env
```

### Testing GitHub Pages Deploy

1. Create test fork
2. Enable GitHub Pages (Actions source)
3. Do NOT set `NEXT_PUBLIC_BASE_PATH` secret
4. Push and wait for deployment
5. Verify site loads at `https://username.github.io/repo-name/`
6. Check browser console for no 404 errors on assets

### Testing Graceful Degradation

1. Deploy without Supabase secrets
2. Visit deployed site
3. Verify dismissible banner appears
4. Dismiss banner
5. Refresh - banner should not reappear (session storage)
6. New session - banner should appear again

## Key Files Modified

| File                           | Change                                |
| ------------------------------ | ------------------------------------- |
| `scripts/rebrand.sh`           | **NEW** - Rebrand automation script   |
| `tests/setup.ts`               | Add Supabase client mock              |
| `.github/workflows/deploy.yml` | Remove NEXT_PUBLIC_BASE_PATH line     |
| `next.config.ts`               | Treat empty basePath as undefined     |
| `public/sw.js`                 | Dynamic cache names                   |
| `docker-compose.yml`           | Add GIT_AUTHOR env vars               |
| `.env.example`                 | Document GIT_AUTHOR vars              |
| `src/components/Footer.tsx`    | Add template attribution              |
| `.gitignore`                   | Add manifest.json                     |
| `README.md`                    | Add "Forking This Template" section   |
| `CLAUDE.md`                    | Document Supabase secrets requirement |
