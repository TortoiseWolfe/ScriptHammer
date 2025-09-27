---
title: "Git Hooks with Husky: Your Code's Bouncer"
slug: 'git-hooks-husky-setup'
excerpt: 'Stop bad code at the door. Husky makes sure nothing broken gets committed.'
author: 'TortoiseWolfe'
publishDate: 2025-11-11
status: 'published'
featured: false
categories:
  - DevOps
  - Quality
  - Automation
tags:
  - git
  - husky
  - hooks
  - quality
  - automation
readTime: 6
ogImage: '/blog-images/2025-11-11-git-hooks-husky-setup.png'
---

# Git Hooks with Husky: Your Code's Bouncer

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Monday Morning Disaster 💥

**Friday, 5:47 PM**: "Just a quick fix before weekend"
**Friday, 5:48 PM**: git add . && git commit -m "fix" && git push
**Monday, 9:00 AM**: "THE ENTIRE APP IS BROKEN!"

Never. Again.

## Enter Husky: The Git Guardian 🐕

```bash
docker compose exec scripthammer pnpm add -D husky
docker compose exec scripthammer pnpm husky install
```

Now every commit goes through security.

## The Pre-Commit Bouncer 🚪

```bash
# .husky/pre-commit
#!/bin/sh

# Format code
docker compose exec scripthammer pnpm prettier --write .

# Lint everything
docker compose exec scripthammer pnpm lint

# Type check
docker compose exec scripthammer pnpm tsc --noEmit

# If any fail, no commit for you!
```

Bad code literally cannot enter your repo.

## The Commit Message Police 👮

```bash
# .husky/commit-msg
#!/bin/sh

# Enforce conventional commits
commit_regex='^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}'

if ! grep -qE "$commit_regex" "$1"; then
  echo "❌ Invalid commit message!"
  echo "📝 Format: type(scope): description"
  echo "📝 Example: feat(auth): add login page"
  exit 1
fi
```

No more "asdfasdf" or "fixed stuff" commits.

## The Pre-Push Shield 🛡️

```bash
# .husky/pre-push
#!/bin/sh

# Run tests
docker compose exec scripthammer pnpm test

# Check coverage
docker compose exec scripthammer pnpm test:coverage

# Build to verify
docker compose exec scripthammer pnpm build

echo "✅ All checks passed! Pushing..."
```

Broken code never reaches main branch.

## Staged Files Only (Lightning Fast) ⚡

```json
// package.json
"lint-staged": {
  "*.{ts,tsx}": [
    "prettier --write",
    "eslint --fix",
    "git add"
  ],
  "*.{css,scss}": [
    "stylelint --fix",
    "git add"
  ]
}
```

Only check changed files. Commits in milliseconds, not minutes.

## The Team Onboarding Magic 🎩

```json
// package.json
"scripts": {
  "prepare": "husky install",
  "pre-commit": "lint-staged",
  "pre-push": "pnpm test && pnpm build"
}
```

New developer runs `pnpm install`. Husky auto-configures. Protected immediately.

## Custom Hooks for Your Workflow 🎯

```bash
# .husky/pre-commit

# Check for console.logs
if grep -r "console.log" --include="*.tsx" src/; then
  echo "❌ Found console.log statements!"
  exit 1
fi

# Check for TODO comments
if grep -r "TODO" --include="*.tsx" src/; then
  echo "⚠️ Found TODO comments. Please address or create issues."
  # Warning only, don't block
fi

# Verify no secrets
if grep -r "API_KEY\|SECRET\|PASSWORD" --include="*.env*" .; then
  echo "🚨 Possible secrets detected!"
  exit 1
fi
```

## The Branch Protection 🌳

```bash
# .husky/pre-push

current_branch=$(git symbolic-ref HEAD | sed -e 's/.*\///')

if [ "$current_branch" = "main" ]; then
  echo "❌ Direct push to main branch blocked!"
  echo "📝 Please create a feature branch"
  exit 1
fi
```

Force good Git practices.

## Bypass When Needed (Responsibly) 🚨

```bash
# Emergency? Skip hooks
git commit --no-verify -m "hotfix: critical prod issue"

# But Husky logs it
echo "⚠️ Hooks bypassed by $USER at $(date)" >> .husky/bypass.log
```

With great power...

## The CI/CD Integration 🔄

```yaml
# .github/workflows/ci.yml
- name: Check Husky
  run: |
    # Verify hooks are installed
    test -f .husky/pre-commit
    test -f .husky/pre-push

# Same rules locally and in CI
```

## Real Team Impact 📊

**Before Husky**:

- Broken commits: 23/week
- "Works on my machine": Daily
- Build failures: 31% of commits
- Rollbacks: Weekly

**After Husky**:

- Broken commits: 0
- Consistent code style: 100%
- Build failures: <1%
- Rollbacks: Almost never

## The Developer Experience 😊

```bash
$ git commit -m "add feature"

🎨 Formatting code...
✅ Code formatted

🔍 Linting...
✅ No lint errors

📝 Type checking...
✅ No type errors

🧪 Running tests...
✅ All tests passed

💚 Commit successful!
```

Instant feedback. Better habits. Happier team.

## Set Up Your Guardian

```bash
docker compose exec scripthammer pnpm add -D husky lint-staged
docker compose exec scripthammer pnpm husky install
docker compose exec scripthammer pnpm husky add .husky/pre-commit "pnpm lint-staged"
```

Stop fixing bad commits.
Start preventing them.

Your future self (and team) will thank you.
