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

ScriptHammer automatically configures itself based on your new repository. Use this template, and everything adapts to your project name and settings with minimal setup.

## Prerequisites

- **Docker and Docker Compose installed (MANDATORY)**
- Git configured with a remote repository
- Basic familiarity with terminal commands

**⚠️ IMPORTANT**: This project REQUIRES Docker. Local npm/pnpm commands are NOT supported. All development MUST use Docker containers.

## Quick Start (10-15 minutes first time)

### 1. Use Template on GitHub

Click "Use this template" on [ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer) and create your repository with any name you like.

### 2. Clone Your New Repository

```bash
git clone https://github.com/YourUsername/your-new-repo.git
cd your-new-repo
```

### 3. Create Required .env File

**IMPORTANT**: This step is required for Docker to run with proper permissions.

```bash
# Copy the example file
cp .env.example .env

# Or create it manually with your system's user ID
echo "UID=$(id -u)" > .env
echo "GID=$(id -g)" >> .env
```

### 4. Start Docker (MANDATORY - No Local Development)

```bash
docker compose up
```

Note: First run will take 5-10 minutes to build the Docker image and install dependencies.

**⚠️ DO NOT attempt to run `npm install` or `pnpm install` locally - it WILL NOT WORK.**

### 5. Access Your Project

Your project is now running at `http://localhost:3000` with your repository name automatically detected!

All commands MUST be run inside Docker:

```bash
# ❌ WRONG: pnpm run dev
# ✅ RIGHT: docker compose exec scripthammer pnpm run dev
```

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

## Minimal Manual Setup

Traditional templates require editing multiple files:

- ❌ Update package.json with project name
- ❌ Change configuration files in multiple locations
- ❌ Modify deployment scripts
- ❌ Edit PWA manifests
- ❌ Update hardcoded references throughout codebase

With ScriptHammer:

- ✅ Use template with any name
- ✅ Create `.env` file (one-time, 30 seconds)
- ✅ Most configuration detected automatically from git
- ⚠️ Some components may still have hardcoded values (being improved)

## Common Tasks (All Require Docker)

### Deploy to GitHub Pages

```bash
# MUST use Docker - local commands won't work
docker compose exec scripthammer pnpm run build
docker compose exec scripthammer pnpm run deploy
# Automatically configured for your repository
```

### Use Custom Settings

```bash
# Override with environment variables (still requires Docker)
NEXT_PUBLIC_PROJECT_NAME=CustomName docker compose exec scripthammer pnpm run dev
```

**⚠️ REMINDER**: Every single command in this project MUST be prefixed with `docker compose exec scripthammer`. There are NO exceptions.

### Check Current Config

Look at `src/config/project-detected.ts` after running the build—it shows your detected settings.

## Key Benefits

- **Quick Setup**: Use template and start coding in 10-15 minutes
- **Minimal Configuration**: Only `.env` file required, rest auto-detects
- **Works in Most Environments**: Local Docker, GitHub Actions CI/CD
- **Reduced Errors**: Fewer manual edits means fewer mistakes

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

1. **Use Template** [ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer) (30 seconds)
2. **Clone** your new repository (30 seconds)
3. **Create .env** with `cp .env.example .env` (30 seconds)
4. **Run** `docker compose up` (5-10 minutes first build)
5. **Check** `http://localhost:3000` - your project is ready!

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
_The auto-configuration process: Use Template → Clone → Ready in 3 simple steps_

The magic happens through our detection script that runs at build time, analyzing your git remote to extract project information and automatically generating all configuration files.

## Traditional Setup vs ScriptHammer

![Before and After Comparison](/blog-images/auto-config/before-after.svg)
_Save 30-60 minutes of manual configuration with every new project_

While traditional templates require editing 22+ files and configuration points, ScriptHammer handles everything automatically. No more hunting for hardcoded values or broken references after using the template.

## Troubleshooting

### Common Issues

**Docker permission errors:**

- Make sure your `.env` file contains correct UID/GID values
- Run `id -u` and `id -g` to get your system values
- Ensure Docker daemon is running

**Auto-detection not working:**

- Verify you have a git remote: `git remote -v`
- If no remote, add one: `git remote add origin https://github.com/YourUsername/your-repo.git`
- The detection reads from git remote origin URL

**Project name not updating:**

- Auto-detection runs at BUILD time, not runtime
- Run `docker compose exec scripthammer pnpm run build` to regenerate
- Check `src/config/project-detected.ts` for detected values

**Hardcoded values still showing "ScriptHammer":**

- Some components may still have hardcoded values
- This is a known limitation being addressed
- Main configuration files ARE auto-detected correctly

## The Bottom Line

ScriptHammer significantly reduces setup friction compared to traditional templates. While not completely "zero-config," it automates most configuration through git detection, requiring only minimal setup (creating the `.env` file).

**Minimal configuration. Quick setup. Use template and build.**

---

_P.S. - Check out `/scripts/detect-project.js` to see the complete auto-configuration implementation. It's a pragmatic solution that handles 90% of configuration automatically._
