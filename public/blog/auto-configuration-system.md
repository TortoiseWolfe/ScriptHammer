---
title: 'Auto-Configuration: Use Template and Start Building'
slug: 'auto-configuration-system'
excerpt: "ScriptHammer's auto-configuration eliminates setup friction. Use the template, run Docker, and watch your project automatically adapt with zero manual config."
author: Development Team
date: 2025-09-27
status: scheduled
featured: true
categories:
  - DevOps
  - Automation
  - DX
tags:
  - auto-config
  - automation
  - developer-experience
readTime: '5 min read'
featuredImage: /blog-images/auto-config/featured.svg
featuredImageAlt: Auto-Configuration System - Zero Config Magic for Your New Project
ogImage: /blog-images/auto-config/featured-og.png
---

# Auto-Configuration: Use Template and Start Building

ScriptHammer automatically configures itself based on your new repository. Use this template, and everything adapts to your project name and settings—no manual configuration required.

## Quick Start (2 minutes)

### 1. Use Template on GitHub

Click "Use this template" on [ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer) and create your repository with any name you like.

### 2. Clone and Run

```bash
git clone https://github.com/YourUsername/your-new-repo.git
cd your-new-repo
docker compose up
```

### 3. Start Building

That's it! Your project is configured and running at `http://localhost:3000`.

## What Gets Auto-Configured

When you create from template and clone, ScriptHammer automatically detects and configures:

- **Project Name**: From your repository name
- **Owner Info**: From your GitHub username (not "Admin" or generic names)
- **Author Attribution**: Your actual GitHub username appears everywhere
- **URLs**: For deployment and links
- **PWA Settings**: App name and manifest
- **Build Paths**: For GitHub Pages deployment

### Where to Find Your Configuration

The auto-config system generates configuration at build time:

1. **TypeScript Config**: `/src/config/project-detected.ts` - Strongly typed for your components
2. **JSON Config**: `/src/config/project-detected.json` - Raw configuration data

Check these files after running `docker compose exec scripthammer pnpm run build` - they contain YOUR project's information automatically detected from Git.

## How to Use It

The configuration is available everywhere in your code:

```typescript
// In any component
import { detectedConfig } from '@/config/project-detected';

export function Header() {
  return (
    <div>
      <h1>{detectedConfig.projectName}</h1>
      <a href={detectedConfig.projectUrl}>View on GitHub</a>
    </div>
  );
}
```

```typescript
// In API routes
import { detectedConfig } from '@/config/project-detected';

export async function GET() {
  return Response.json({
    project: detectedConfig.projectName,
    owner: detectedConfig.projectOwner,
  });
}
```

## Zero Manual Setup

Traditional templates require editing multiple files:

- ❌ Update package.json
- ❌ Change configuration files
- ❌ Modify deployment scripts
- ❌ Edit PWA manifests

With ScriptHammer:

- ✅ Fork with any name
- ✅ Clone and run
- ✅ Everything configured automatically

## Common Tasks

### Deploy to GitHub Pages

```bash
docker compose exec scripthammer pnpm run build
docker compose exec scripthammer pnpm run deploy
# Automatically configured for your repository
```

### Use Custom Settings

```bash
# Override with environment variables
NEXT_PUBLIC_PROJECT_NAME=CustomName docker compose exec scripthammer pnpm run dev
```

### Check Current Config

Look at `src/config/project-detected.ts` after running the build—it shows your detected settings.

## Key Benefits

- **Instant Setup**: Fork and start coding in under 2 minutes
- **No Configuration Files**: Everything auto-detects from git
- **Works Everywhere**: Local, Docker, CI/CD—all automatic
- **Always Correct**: No manual edits means no mistakes

## How It Works

The core detection script (`scripts/detect-project.js`) runs at build time:

```javascript
function getProjectInfo() {
  // 1. Check environment variables (highest priority)
  if (
    process.env.NEXT_PUBLIC_PROJECT_NAME &&
    process.env.NEXT_PUBLIC_PROJECT_OWNER
  ) {
    return {
      projectName: process.env.NEXT_PUBLIC_PROJECT_NAME,
      projectOwner: process.env.NEXT_PUBLIC_PROJECT_OWNER,
      source: 'env',
    };
  }

  // 2. Try git remote detection
  const gitUrl = getGitRemoteUrl();
  const gitInfo = parseGitUrl(gitUrl);
  if (gitInfo) {
    return {
      projectName: gitInfo.repo,
      projectOwner: gitInfo.owner,
      source: 'git',
    };
  }

  // 3. Fall back to defaults
  return {
    projectName: 'ScriptHammer',
    projectOwner: 'TortoiseWolfe',
    source: 'default',
  };
}
```

The script (under 180 lines) handles:

- Multiple git remote formats (HTTPS, SSH, various hosts)
- CI/CD environment detection
- Safe file writing with atomic operations
- TypeScript and JSON generation

## Advanced Features

### Environment Detection

Currently supported:

- **GitHub Actions CI** - Automatically configures for GitHub Pages
- **Local Docker Development** - Consistent development environment
- **Local Development** - Standard local configuration

Coming Soon (Sprint 4):

- **Vercel Deployment** - Platform-specific optimization
- **Netlify Deployment** - Automatic configuration
- **AWS/Azure/GCP** - Cloud platform detection
- **Kubernetes/Docker Swarm** - Container orchestration

### Multiple Environments

```bash
# Development
docker compose exec scripthammer pnpm run dev

# Staging
NEXT_PUBLIC_PROJECT_NAME=staging-app docker compose exec scripthammer pnpm run build

# Production
docker compose exec scripthammer pnpm run build  # Uses git remote info
```

## Try It Now

1. **Fork** [ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer) (30 seconds)
2. **Clone** your fork (30 seconds)
3. **Run** `docker compose up` (1 minute)
4. **Check** `http://localhost:3000` - your project is ready!

### What You'll See

- Title bar shows YOUR project name
- Footer links to YOUR GitHub repository
- PWA installer shows YOUR app name
- `/status` page displays YOUR project info
- All configuration files have YOUR details

## Technical Details

### Generated Files

Configuration files are generated at build time (not committed to git):

- `src/config/project-detected.ts` - TypeScript configuration
- `src/config/project-detected.json` - JSON for build scripts
- `public/manifest.json` - PWA manifest with your project name
- Meta tags and URLs throughout the application

### Git Remote Parsing

Supports multiple formats:

- `https://github.com/user/repo.git`
- `git@github.com:user/repo.git`
- `https://gitlab.com/user/repo.git`
- `git@bitbucket.org:user/repo.git`

### Build Integration

```json
// package.json
{
  "scripts": {
    "dev": "node scripts/detect-project.js && next dev",
    "build": "node scripts/detect-project.js && next build"
  }
}
```

## Visual Overview

![Auto-Configuration Flow Diagram](/blog-images/auto-config/config-flow.svg)
_The auto-configuration process: Fork → Clone → Ready in 3 simple steps_

The magic happens through our detection script that runs at build time, analyzing your git remote to extract project information and automatically generating all configuration files.

## Traditional Setup vs ScriptHammer

![Before and After Comparison](/blog-images/auto-config/before-after.svg)
_Save 30-60 minutes of manual configuration with every new project_

While traditional templates require editing 22+ files and configuration points, ScriptHammer handles everything automatically. No more hunting for hardcoded values or broken references after forking.

## The Bottom Line

ScriptHammer eliminates setup friction. Fork it, name it whatever you want, and start building immediately. The configuration handles itself.

**No configuration. No setup. Just fork and build.**

---

_P.S. - Check out `/scripts/detect-project.js` to see the complete auto-configuration implementation. It's refreshingly simple for something so powerful._
