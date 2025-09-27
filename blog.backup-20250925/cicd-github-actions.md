---
title: 'The CI/CD Pipeline That Deploys While You Sleep'
slug: 'cicd-github-actions'
excerpt: 'How I went from manual deployments at 2 AM to GitHub Actions doing everything automatically.'
author: 'TortoiseWolfe'
publishDate: 2025-11-10
status: 'published'
featured: false
categories:
  - CI/CD
  - DevOps
  - Automation
tags:
  - github-actions
  - ci-cd
  - automation
  - deployment
readTime: 7
ogImage: '/blog-images/2025-11-10-cicd-github-actions.png'
---

# The CI/CD Pipeline That Deploys While You Sleep

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Friday Deploy That Ruined My Weekend 📅💥

Friday, 4:47 PM. One small feature to deploy.

"It's just a button color change, what could go wrong?"

_Everything. Everything went wrong._

- Forgot to run tests (3 broken)
- Forgot to build (TypeScript errors)
- Forgot to update dependencies (version mismatch)
- Pushed to production anyway (I was tired)
- Site went down at 6 PM (during dinner)
- Fixed it at 11 PM (weekend ruined)

That's when I swore: Never. Again.

Enter ScriptHammer's GitHub Actions CI/CD.

## The Old Deploy Dance 💃

Remember this ritual?

```bash
# The Manual Deploy Checklist of Doom
1. Run tests locally (forget this 50% of the time)
2. Build the project (catch TypeScript errors)
3. Check lint issues (usually skip)
4. Update version number (definitely forget)
5. Create git tag (what's the format again?)
6. Push to main (pray)
7. SSH to server (find that key...)
8. Pull latest code
9. Install dependencies
10. Run migrations
11. Restart services
12. Check if it worked
13. Fix what broke
14. Repeat until working
```

**Time**: 30-45 minutes
**Stress Level**: Maximum
**Error Rate**: High

## The ScriptHammer Way: Push and Forget 🚀

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # It all happens automatically
```

**Time**: 0 minutes (you're done after git push)
**Stress Level**: Zero
**Error Rate**: Near zero

## The Pipeline That Has Your Back 🛡️

### Stage 1: The Bouncer (Pre-commit)

Before you can even push:

```yaml
# Husky hooks catch issues locally
pre-commit:
  - lint-staged # Format your code
  - type-check # TypeScript errors
  - test:unit # Broken tests

# Can't commit broken code!
```

### Stage 2: The Guardian (Pull Request)

```yaml
name: PR Checks
on: pull_request

jobs:
  quality-gates:
    steps:
      - name: Lint Code
        run: pnpm lint

      - name: Type Check
        run: pnpm type-check

      - name: Unit Tests
        run: pnpm test

      - name: Coverage Check
        run: pnpm test:coverage
        # Fails if coverage drops below 58%

      - name: Build
        run: pnpm build
        # Can it actually build?
# PR can't merge if any check fails
```

### Stage 3: The Builder (Main Branch)

```yaml
name: Deploy Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Test Everything
        run: |
          pnpm lint
          pnpm type-check
          pnpm test
          pnpm test:e2e

      - name: Build Production
        run: pnpm build
        env:
          NODE_ENV: production

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
# Deployed! You did nothing!
```

## Real Success Stories 🏆

### The 3 AM Deploy That Didn't Wake Me

```yaml
# Dependabot merged a security update at 3:17 AM
# CI/CD:
✓ Ran 725 tests
✓ Checked types
✓ Built production
✓ Deployed to staging
✓ Ran E2E tests
✓ Deployed to production
✓ Sent success notification
# I woke up to: "Deployment successful ✅"
```

### The Intern Who Deployed on Day One

> "I made a typo fix PR. It got reviewed, merged, and deployed to production in 12 minutes. I didn't do anything after pushing. This is magic." - New intern

### The Friday Deploy That Didn't Ruin Anyone's Weekend

```yaml
# Friday 4:47 PM push
git push origin main

# CI/CD does:
- 🧪 Runs 725 tests (2 min)
- 📝 Type checks (30 sec)
- 🎨 Lints code (20 sec)
- 📦 Builds production (1 min)
- 🚀 Deploys (30 sec)
- ✅ Runs E2E tests (2 min)

# Friday 4:53 PM
"Deployment successful"

# Weekend: SAVED
```

## The Secret Sauce Features 🎯

### Feature 1: Parallel Jobs

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
  lint:
    runs-on: ubuntu-latest
  build:
    runs-on: ubuntu-latest
# All run AT THE SAME TIME
# 3x faster than sequential
```

### Feature 2: Matrix Testing

```yaml
strategy:
  matrix:
    node-version: [16, 18, 20]
    os: [ubuntu-latest, windows-latest, macos-latest]
# Tests on 9 combinations automatically
```

### Feature 3: Caching That Actually Works

```yaml
- uses: actions/setup-node@v3
  with:
    cache: 'pnpm'

- uses: actions/cache@v3
  with:
    path: ${{ github.workspace }}/.next/cache
    key: nextjs-cache-${{ hashFiles('pnpm-lock.yaml') }}
# First run: 5 minutes
# Subsequent runs: 2 minutes
```

### Feature 4: Smart Deployment

```yaml
- name: Deploy Only If Changed
  run: |
    if git diff --quiet HEAD^ HEAD -- ./src; then
      echo "No source changes, skipping deploy"
      exit 0
    fi
    pnpm deploy
```

## The Notifications That Don't Annoy 📱

```yaml
# Only notify on failure
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment failed! Check it out.'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
# Success = silence (it's expected)
# Failure = immediate notification
```

## The Rollback That's Not Scary 🔄

```yaml
# Something went wrong in production?

# Option 1: Revert PR
git revert HEAD
git push
# CI/CD automatically deploys previous version

# Option 2: Deploy specific version
- name: Deploy Specific Tag
  if: github.event.inputs.version
  run: |
    git checkout ${{ github.event.inputs.version }}
    pnpm build
    pnpm deploy

# Fixed in minutes, not hours
```

## Setting Up Your Own Pipeline 🛠️

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
      - run: pnpm build

  deploy:
    needs: quality
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      # Add your deploy steps
```

## The Metrics That Matter 📊

Before GitHub Actions:

- **Deploy time**: 30-45 minutes
- **Deploy frequency**: Once a week (scared)
- **Rollback time**: 1-2 hours
- **Weekend deploys**: Never
- **Stress level**: 9/10

After GitHub Actions:

- **Deploy time**: 0 minutes (automated)
- **Deploy frequency**: 10+ times daily
- **Rollback time**: 3 minutes
- **Weekend deploys**: Anytime
- **Stress level**: 2/10

## The Bottom Line ✅

I used to dread deployments.

Now I don't even think about them.

Push to main. Go get coffee. It's deployed.

That's the ScriptHammer way.

---

_P.S. - Yes, you can still deploy manually if you want. But why would you?_

_P.P.S. - The best deployment is the one you don't have to think about._
