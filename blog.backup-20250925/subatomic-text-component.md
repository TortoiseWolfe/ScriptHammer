---
title: 'The Text Component That Rules Them All'
slug: 'subatomic-text-component'
excerpt: 'One component to replace every h1, p, span, and div with text. The foundation of everything.'
author: 'TortoiseWolfe'
publishDate: 2025-10-11
status: 'published'
featured: false
categories:
  - Components
  - Subatomic
  - Typography
tags:
  - text
  - typography
  - subatomic
  - components
  - foundation
readTime: 7
ogImage: '/blog-images/2025-10-11-subatomic-text-component.png'
---

# The Text Component That Rules Them All

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec crudkit pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Typography Nightmare 💀

I once worked on a project with:

- 47 different font sizes
- 23 shades of "almost black"
- 12 ways to make text bold
- No two headings the same

The CSS file was 2MB. Just for text styles.

## Enter: The One Text Component ✨

```tsx
<Text size="xl" weight="bold" color="primary">
  I can be anything
</Text>
```

No more:

- `<h1 className="text-2xl font-bold text-gray-900">`
- `<p style={{fontSize: '18px', fontWeight: 600}}>`
- `<span class="heading-large-bold-dark">`

## The Subatomic Philosophy 🔬

Subatomic components have ONE job:

- Text displays text
- Icon shows icons
- Image handles images

That's it. No mixing. No confusion.

## Every Combination, Predefined

```tsx
// Sizes
<Text size="xs">Tiny</Text>
<Text size="sm">Small</Text>
<Text size="md">Medium</Text>
<Text size="lg">Large</Text>
<Text size="xl">Extra Large</Text>

// Weights
<Text weight="light">Light</Text>
<Text weight="normal">Normal</Text>
<Text weight="bold">Bold</Text>

// Colors (semantic!)
<Text color="primary">Primary</Text>
<Text color="secondary">Secondary</Text>
<Text color="muted">Muted</Text>
<Text color="danger">Error!</Text>
```

## The Ripple Effect 🌊

When you standardize text:

- Designers stop inventing new sizes
- Developers stop adding custom styles
- Consistency happens automatically
- Accessibility is built in

## Real Impact

**Before Text component**: "Is this 16px or 18px? Is it gray-700 or gray-800?"

**After Text component**: `<Text size="md" color="muted">Done.</Text>`

The entire app's typography. One component. Zero debates.
