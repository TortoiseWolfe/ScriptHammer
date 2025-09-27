---
title: 'CodeBlock: The Component That Made Our Docs Not Suck'
slug: 'codeblock-syntax-highlighting'
excerpt: 'Syntax highlighting, copy buttons, and language badges. Everything developers expect.'
author: 'TortoiseWolfe'
publishDate: 2025-10-15
status: 'published'
featured: false
categories:
  - Components
  - Developer Tools
  - UI
tags:
  - code
  - syntax-highlighting
  - components
  - developer-tools
readTime: 6
ogImage: '/blog-images/2025-10-15-codeblock-syntax-highlighting.png'
---

# CodeBlock: The Component That Made Our Docs Not Suck

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Documentation Graveyard 🪦

Every developer blog starts the same:

1. "Let's add code examples!"
2. Discovers syntax highlighting is hard
3. Tries 5 different libraries
4. Gives up, uses screenshots
5. Screenshots get outdated
6. Documentation dies

## Enter: The CodeBlock That Works 🎨

```tsx
<CodeBlock language="typescript" showLineNumbers>
  {`const greeting = "Hello, World!";
console.log(greeting);`}
</CodeBlock>
```

Syntax highlighting ✅
Line numbers ✅
Copy button ✅
Done.

## Features Developers Actually Use

### The Copy Button That Always Works

```tsx
<CodeBlock copyButton>docker compose exec scripthammer pnpm run dev</CodeBlock>
```

One click. Copied. With success feedback.

### Line Highlighting for Emphasis

```tsx
<CodeBlock highlightLines={[3, 5, '7-9']}>
  {`function example() {
  const a = 1;
  const b = 2; // This line is highlighted
  const c = 3;
  return a + b; // This too
}`}
</CodeBlock>
```

### File Names for Context

```tsx
<CodeBlock fileName="docker-compose.yml" language="yaml">
  {`services:
  scripthammer:
    build: .
    ports:
      - "3000:3000"`}
</CodeBlock>
```

## The Language Support That Matters

- JavaScript/TypeScript (obviously)
- Python (data scientists rejoice)
- Bash (for those Docker commands)
- YAML (config files everywhere)
- JSON (API responses)
- CSS (still necessary)
- HTML (sometimes)
- SQL (database queries)
- Markdown (meta!)

## Themes That Don't Burn Retinas 👀

```tsx
// Automatic theme switching
<CodeBlock theme="auto">
  // Light mode: GitHub Light // Dark mode: Dracula // User's choice: Respected
</CodeBlock>
```

## The Diff View That Explains Changes

```tsx
<CodeBlock language="diff">
  {`- const old = "bad code";
+ const new = "good code";
  const unchanged = "still here";`}
</CodeBlock>
```

Green additions. Red deletions. Crystal clear.

## Performance That Doesn't Suck 🚀

- Lazy loading for large snippets
- Virtual scrolling for 1000+ lines
- Syntax highlighting on worker thread
- No main thread blocking
- Butter smooth scrolling

## Real World Impact

**Before CodeBlock**:

- "Your docs are hard to follow"
- "Can't copy the commands"
- "Code is unreadable"
- Stack Overflow links everywhere

**After CodeBlock**:

- "Best docs I've seen"
- "Love the copy button!"
- "So easy to follow"
- Stack Overflow who?

## The Bottom Line

Good code examples = Happy developers
Happy developers = Successful project

It's that simple.
