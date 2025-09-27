---
title: 'Pre-Push Hooks: The Last Line of Defense'
slug: 'pre-push-hooks-testing'
excerpt: 'That final check before code goes public. Pre-push hooks catch what everything else missed.'
author: 'TortoiseWolfe'
publishDate: 2025-11-13
status: 'published'
featured: false
categories:
  - Testing
  - Git
  - Quality
tags:
  - git-hooks
  - testing
  - pre-push
  - quality
  - ci-cd
readTime: 6
ogImage: '/blog-images/2025-11-13-pre-push-hooks-testing.png'
---

# Pre-Push Hooks: The Last Line of Defense

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The "It Worked Locally" Disaster 💣

**You**: "Tests pass locally!"
**CI**: "Build failed"
**Team**: "Main branch is broken"
**You**: "But it worked on my machine..."

Never again. Pre-push hooks ensure it.

## The Ultimate Gatekeeper 🚪

```bash
# .husky/pre-push
#!/bin/sh

echo "🔍 Running pre-push checks..."

# 1. Run ALL tests
docker compose exec scripthammer pnpm test || exit 1

# 2. Type check everything
docker compose exec scripthammer pnpm tsc --noEmit || exit 1

# 3. Build to verify
docker compose exec scripthammer pnpm build || exit 1

# 4. Check test coverage
docker compose exec scripthammer pnpm test:coverage || exit 1

echo "✅ All checks passed! Pushing..."
```

If it fails here, it never reaches GitHub.

## Smart Performance Optimization ⚡

```bash
# Only test what changed
CHANGED_FILES=$(git diff --name-only origin/main...HEAD)

if echo "$CHANGED_FILES" | grep -q "\.tsx\?$"; then
  echo "📝 TypeScript files changed, running type check..."
  docker compose exec scripthammer pnpm tsc --noEmit
fi

if echo "$CHANGED_FILES" | grep -q "\.test\." ; then
  echo "🧪 Test files changed, running tests..."
  docker compose exec scripthammer pnpm test
fi

# Always run on main/release branches
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "main" || "$BRANCH" == "release/*" ]]; then
  docker compose exec scripthammer pnpm test:all
fi
```

Fast for features. Thorough for main.

## The Security Scanner 🔒

```bash
# .husky/pre-push

# Check for secrets
echo "🔍 Scanning for secrets..."
docker compose exec scripthammer pnpm secretlint "**/*"

# Audit dependencies
echo "🔍 Auditing dependencies..."
docker compose exec scripthammer pnpm audit --audit-level=high

# Check for console.logs
if grep -r "console.log" --include="*.ts" --include="*.tsx" src/; then
  echo "❌ Found console.log statements!"
  echo "🔧 Remove them before pushing"
  exit 1
fi
```

## Branch Protection Rules 🌳

```bash
# Prevent direct pushes to main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
PROTECTED_BRANCHES="main|develop|release/*"

if echo "$BRANCH" | grep -qE "$PROTECTED_BRANCHES"; then
  echo "❌ Direct push to $BRANCH is not allowed!"
  echo "📝 Please create a feature branch and PR"
  exit 1
fi

# Enforce branch naming
if ! echo "$BRANCH" | grep -qE "^(feature|fix|hotfix|chore)/"; then
  echo "❌ Invalid branch name: $BRANCH"
  echo "📝 Use: feature/*, fix/*, hotfix/*, or chore/*"
  exit 1
fi
```

## The Diff Analyzer 📊

```bash
# Check size of changes
LINES_CHANGED=$(git diff --stat origin/main...HEAD | tail -1 | awk '{print $4}')

if [ "$LINES_CHANGED" -gt 500 ]; then
  echo "⚠️ Large PR detected: $LINES_CHANGED lines changed"
  echo "📝 Consider breaking into smaller PRs"
  read -p "Continue anyway? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

## Integration Tests Runner 🧪

```bash
# Run integration tests for API changes
if git diff --name-only origin/main...HEAD | grep -q "api/"; then
  echo "🌐 API changes detected, running integration tests..."

  # Start test server
  docker compose exec scripthammer pnpm start:test &
  SERVER_PID=$!

  # Wait for server
  sleep 5

  # Run integration tests
  docker compose exec scripthammer pnpm test:integration

  # Cleanup
  kill $SERVER_PID
fi
```

## The Documentation Enforcer 📚

```bash
# Check if README is updated for new features
if git diff --name-only origin/main...HEAD | grep -q "src/features/"; then
  if ! git diff --name-only origin/main...HEAD | grep -q "README\|CHANGELOG"; then
    echo "❌ New feature without documentation!"
    echo "📝 Please update README or CHANGELOG"
    exit 1
  fi
fi
```

## Emergency Override 🚨

```bash
# For those rare emergencies
if [ "$SKIP_HOOKS" = "true" ]; then
  echo "⚠️ Pre-push hooks skipped by $USER"
  echo "📝 Reason required for audit:"
  read -p "Why are you skipping checks? " reason
  echo "$(date): $USER skipped pre-push: $reason" >> .husky/skip-log.txt
  exit 0
fi

# Usage: SKIP_HOOKS=true git push
```

## The Metrics Dashboard 📈

```bash
# Track hook effectiveness
echo "📊 Pre-push stats:"
echo "  Tests run: $(docker compose exec scripthammer pnpm test --listTests | wc -l)"
echo "  Coverage: $(docker compose exec scripthammer pnpm test:coverage --silent | grep "All files" | awk '{print $10}')"
echo "  Build time: $(time docker compose exec scripthammer pnpm build 2>&1 | grep real)"
```

## Real Impact 🎯

**Before pre-push hooks**:

- Broken builds: 12/week
- "Works locally" issues: Daily
- Time to fix breaks: 30-60 min
- Team frustration: High

**After pre-push hooks**:

- Broken builds: <1/month
- Everything works everywhere
- No emergency fixes
- Team confidence: Maximum

## Install Your Defense

```bash
# Add pre-push hook
docker compose exec scripthammer npx husky add .husky/pre-push "pnpm test && pnpm build"

# Make it executable
chmod +x .husky/pre-push

# Never push broken code again
```

Stop breaking builds.
Start catching issues early.

Your team will thank you.
