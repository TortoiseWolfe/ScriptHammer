# Phase 0 Research: Template Fork Experience

**Date**: 2025-12-10
**Branch**: 011-feature-038-template

## Executive Summary

Research into the ScriptHammer codebase reveals a well-architected project auto-detection system already in place. The main gaps are:

1. Service worker cache names are hardcoded
2. manifest.json is static (not generated)
3. robots.txt has hardcoded sitemap URL
4. No rebrand script exists
5. Test setup lacks Supabase mocking for env-free testing

## Existing Infrastructure Analysis

### What's Already Fork-Ready

| Component              | File                           | Status                           |
| ---------------------- | ------------------------------ | -------------------------------- |
| Project Auto-Detection | `scripts/detect-project.js`    | Excellent - parses git remote    |
| basePath Handling      | `next.config.ts`               | Working - uses detection script  |
| Docker Git Config      | `docker/Dockerfile:83`         | Present - `safe.directory /app`  |
| Environment Variables  | `.env.example`                 | Comprehensive documentation      |
| GitHub Actions         | `.github/workflows/deploy.yml` | Supports `NEXT_PUBLIC_BASE_PATH` |

### What Needs Implementation

| Component      | File                        | Issue                                 |
| -------------- | --------------------------- | ------------------------------------- |
| Service Worker | `public/sw.js:4`            | Hardcoded `scripthammer-v1.0.0` cache |
| Manifest       | `public/manifest.json`      | Static file, not generated            |
| robots.txt     | `public/robots.txt`         | Hardcoded sitemap URL                 |
| Footer         | `src/components/Footer.tsx` | No template attribution link          |
| Test Setup     | `tests/setup.ts`            | No Supabase client mock               |
| Rebrand Script | N/A                         | Does not exist                        |

## File Analysis

### 1. Service Worker (`public/sw.js`)

```javascript
// Line 4 - HARDCODED
const CACHE_VERSION = 'scripthammer-v1.0.0';
```

**Fix Required**: Use dynamic cache name from project config or inject at build time.

### 2. Project Detection (`scripts/detect-project.js`)

Already implements:

- Git remote URL parsing (HTTPS, SSH, GitHub CLI formats)
- Environment variable overrides
- basePath generation for GitHub Actions
- Outputs to `src/config/project-detected.json`

**No changes needed** - excellent implementation.

### 3. Test Setup (`tests/setup.ts`)

Current mocks:

- AuthContext (test user)
- Next.js navigation
- Canvas/Image operations
- IntersectionObserver, ResizeObserver

**Missing**: Supabase client mock for tests without `.env` file.

### 4. Docker Configuration

`docker/Dockerfile:83`:

```dockerfile
RUN git config --global --add safe.directory /app
```

**Already implemented** - no changes needed.

`docker-compose.yml`:

- Service name `scripthammer` is hardcoded
- GIT_AUTHOR_NAME/EMAIL not passed through

### 5. GitHub Actions (`deploy.yml`)

Line 63: `NEXT_PUBLIC_BASE_PATH: ${{ secrets.NEXT_PUBLIC_BASE_PATH }}`

**Issue**: Empty string passed when secret doesn't exist, bypasses auto-detection.

### 6. Hardcoded Reference Count

| Category      | Count | Files                                          |
| ------------- | ----- | ---------------------------------------------- |
| Code/Config   | 17    | sw.js, manifest.json, robots.txt, config files |
| Documentation | 25    | README, docs/, specs/                          |
| **Total**     | 42    | 20 files                                       |

## Recommended Implementation Approach

### Priority 1: Rebrand Script (`scripts/rebrand.sh`)

Create comprehensive shell script that:

1. Accepts: `NEW_NAME`, `NEW_OWNER`, `NEW_DESCRIPTION`
2. Auto-sanitizes input (spaces→hyphens, remove special chars)
3. Replaces all case variations in file contents
4. Renames files containing "ScriptHammer"
5. Updates docker-compose service name
6. Deletes public/CNAME
7. Updates git remote origin
8. Verbose output per file

### Priority 2: Test Infrastructure

Add to `tests/setup.ts`:

```typescript
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
  getSupabase: vi.fn(() => mockSupabaseClient),
}));
```

### Priority 3: Dynamic Service Worker

Option A: Build-time injection via webpack
Option B: Runtime config fetch from `/config.json`

**Recommended**: Build-time injection - simpler, no runtime overhead.

### Priority 4: GitHub Actions Fix

Remove `NEXT_PUBLIC_BASE_PATH` line from deploy.yml OR update next.config.ts:

```typescript
const envBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
if (envBasePath !== undefined && envBasePath !== '') {
  return envBasePath;
}
```

### Priority 5: Documentation

- Add "Forking This Template" section to README
- Document Supabase GitHub secrets requirement
- Add template attribution to Footer

## Risk Assessment

| Risk                        | Impact | Mitigation                               |
| --------------------------- | ------ | ---------------------------------------- |
| Rebrand script misses files | High   | Test with actual fork, grep verification |
| Cache collision in browser  | Medium | Dynamic cache names                      |
| Tests fail on fork          | High   | Comprehensive Supabase mock              |
| Deploy fails on fork        | High   | Fix basePath empty string handling       |

## Dependencies

- No new npm packages required
- Shell script uses standard Unix tools (sed, find, grep)
- All changes are configuration/infrastructure level
