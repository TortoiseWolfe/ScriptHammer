# Data Model: Template Fork Experience

**Date**: 2025-12-10
**Branch**: 011-feature-038-template

## Overview

This feature is primarily infrastructure/tooling focused. No database schema changes required.

## Configuration Entities

### Project Config (Runtime)

```typescript
interface ProjectConfig {
  projectName: string; // e.g., "MyApp"
  projectOwner: string; // e.g., "myuser"
  projectDescription: string;
  basePath: string; // e.g., "/MyApp" or ""
  projectUrl: string; // GitHub repo URL
  deployUrl: string; // Production URL
}
```

**Source**: `src/config/project.config.ts` (already exists)

### Rebrand Script Arguments

```bash
./scripts/rebrand.sh <PROJECT_NAME> <OWNER> "<DESCRIPTION>"
```

| Argument     | Required | Example              | Validation                     |
| ------------ | -------- | -------------------- | ------------------------------ |
| PROJECT_NAME | Yes      | "MyApp"              | Auto-sanitized: spaces→hyphens |
| OWNER        | Yes      | "myuser"             | GitHub username format         |
| DESCRIPTION  | Yes      | "My app description" | Quoted string, any text        |

### Service Worker Cache Names (Dynamic)

```javascript
// Before (hardcoded)
const CACHE_VERSION = 'scripthammer-v1.0.0';

// After (dynamic)
const CACHE_VERSION = `${PROJECT_NAME.toLowerCase()}-v${VERSION}`;
```

## File Transformations

### Rebrand Script Target Files

| Category   | Pattern                                            | Action              |
| ---------- | -------------------------------------------------- | ------------------- |
| Content    | `*.ts`, `*.tsx`, `*.js`, `*.json`, `*.md`, `*.yml` | sed replacement     |
| File Names | `*ScriptHammer*`                                   | mv rename           |
| Special    | `docker-compose.yml`                               | Service name update |
| Special    | `public/CNAME`                                     | Delete              |
| Special    | `.git/config`                                      | Update remote URL   |

### Files Excluded from Rebrand

- `node_modules/`
- `.next/`
- `out/`
- `.git/` (except config)
- `*.lock` files

## State Management

### Setup Banner Dismissal

```typescript
// Session storage key
const SETUP_BANNER_DISMISSED = 'supabase_setup_banner_dismissed';

// Value: 'true' | null
sessionStorage.getItem(SETUP_BANNER_DISMISSED);
```

## No Database Changes

This feature does not modify:

- Supabase schema
- RLS policies
- Database functions
- Edge functions
