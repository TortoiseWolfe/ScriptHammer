---
title: 'Prettier: The Code Formatting War Ender'
slug: 'prettier-code-formatting'
excerpt: 'Stop arguing about tabs vs spaces. Let Prettier decide. Move on with life.'
author: 'TortoiseWolfe'
publishDate: 2025-11-12
status: 'published'
featured: false
categories:
  - Developer Tools
  - Code Quality
  - Automation
tags:
  - prettier
  - formatting
  - code-style
  - automation
  - developer-tools
readTime: 6
ogImage: '/blog-images/2025-11-12-prettier-code-formatting.png'
---

# Prettier: The Code Formatting War Ender

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Great Debate That Wasted Years 🥊

**Team A**: "Tabs are superior!"
**Team B**: "Spaces are standard!"
**Team A**: "2 spaces!"
**Team B**: "4 spaces!"
**Manager**: "Can we please ship something?"

Enter Prettier. Debate over. Code ships.

## Install and Forget 🎯

```bash
docker compose exec scripthammer pnpm add -D prettier
echo {}> .prettierrc
echo "node_modules" > .prettierignore
```

That's it. You're done. Forever.

## The Config That Ends Arguments 📝

```json
// .prettierrc
{
  "semi": true, // Semicolons: yes
  "singleQuote": true, // Single quotes
  "tabWidth": 2, // 2 spaces
  "printWidth": 80, // Line length
  "trailingComma": "es5" // Trailing commas
}
```

5 lines. Entire team aligned. Move on.

## Format on Save (Life Changing) 💾

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.formatOnSave": true
  }
}
```

Write garbage. Save. Magic happens. Clean code.

## The Before and After 🎨

```typescript
// You write this mess:
const data = {
  name: 'John',
  age: 30,
  address: { street: 'Main St', city: 'Boston', zip: 12345 },
  hobbies: ['coding', 'gaming', 'reading'],
};

// Save. Prettier gives you:
const data = {
  name: 'John',
  age: 30,
  address: {
    street: 'Main St',
    city: 'Boston',
    zip: 12345,
  },
  hobbies: ['coding', 'gaming', 'reading'],
};
```

No effort. Perfect every time.

## Git Hooks Integration 🪝

```bash
# .husky/pre-commit
#!/bin/sh
docker compose exec scripthammer pnpm prettier --check .

# Or auto-fix:
docker compose exec scripthammer pnpm prettier --write .
git add .
```

Ugly code literally cannot be committed.

## The CI/CD Enforcer 🚓

```yaml
# .github/workflows/ci.yml
- name: Check formatting
  run: |
    docker compose exec scripthammer pnpm prettier --check .
    if [ $? -ne 0 ]; then
      echo "❌ Code not formatted!"
      echo "Run: pnpm prettier --write ."
      exit 1
    fi
```

Unformatted code never reaches production.

## Team-Wide Instant Adoption 🚀

```bash
# Format entire codebase
docker compose exec scripthammer pnpm prettier --write .

# 10,000 files formatted in 30 seconds
# Every file now identical style
# Team confusion: eliminated
```

## The Edge Cases Handled 📐

```typescript
// Long function calls
someReallyLongFunctionName(
  firstArgument,
  secondArgument,
  thirdArgument,
  fourthArgument
);

// Nested ternaries
const result = condition1 ? value1 : condition2 ? value2 : defaultValue;

// Prettier knows best
```

## Ignore What Doesn't Matter 🙈

```
# .prettierignore
build/
coverage/
*.min.js
*.md
package-lock.json
```

Don't format generated files. Waste of time.

## The Conflicts That Disappear 💨

**Before Prettier**:

```diff
- function test() {
+ function test()
+ {
-   return true
+   return true;
}
```

Merge conflicts everywhere.

**After Prettier**:
Everyone's code identical. Conflicts rare. Merges smooth.

## Language Support 🌍

Prettier formats:

- JavaScript/TypeScript
- CSS/SCSS/Less
- HTML/Vue/Angular
- JSON/YAML
- Markdown
- GraphQL

One tool. All languages. Consistent everywhere.

## The ROI Calculator 💰

**Without Prettier**:

- Code review formatting comments: 40%
- Time arguing about style: 2 hours/week
- Inconsistent codebase: Always

**With Prettier**:

- Formatting comments: 0%
- Style arguments: 0 minutes
- Consistent codebase: 100%
- Time saved: 100+ hours/year

## The Team Feedback 💬

"I can't work without Prettier anymore" - Everyone

"We review logic now, not formatting" - Tech Lead

"Best tool we ever added" - CTO

## Start Prettier Today

```bash
# Install
docker compose exec scripthammer pnpm add -D prettier

# Format everything
docker compose exec scripthammer pnpm prettier --write .

# Add to pre-commit
echo 'pnpm prettier --write .' >> .husky/pre-commit

# Never think about formatting again
```

Stop debating.
Start shipping.

Let Prettier handle the boring stuff.
