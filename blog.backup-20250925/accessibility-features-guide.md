---
title: "That Time My Colorblind Friend Couldn't Use My App (And How I Fixed It)"
slug: 'accessibility-features-guide'
excerpt: 'The green button incident that made me take accessibility seriously, and how ScriptHammer makes it automatic.'
author: 'TortoiseWolfe'
publishDate: 2025-10-31
status: 'published'
featured: false
categories:
  - Accessibility
  - UX
  - Development
tags:
  - accessibility
  - a11y
  - colorblind
  - wcag
  - inclusive-design
readTime: 9
ogImage: '/blog-images/2025-10-31-accessibility-features-guide.png'
---

# That Time My Colorblind Friend Couldn't Use My App (And How I Fixed It)

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Green Button Incident 🟢🔴

Picture this: I'm showing off my new app to my friend Jake.

"Click the green button to continue," I say.

Jake stares at the screen. "Which one's green?"

Oh. _Oh no._

Jake's colorblind. The "green" success button and "red" error button? They look identical to him.

And that's when I realized my "accessible" app... wasn't.

## The Accessibility Guilt Spiral 😰

You know the stages:

1. **Denial**: "It's probably fine, most people can see colors"
2. **Anger**: "Why didn't anyone tell me about this?"
3. **Bargaining**: "Maybe I can just add labels to everything?"
4. **Depression**: "I need to rebuild everything"
5. **Acceptance**: "I need to fix this properly"

Then I found ScriptHammer. It handles all of this. Built-in. From day one.

## The ScriptHammer Accessibility Arsenal 🛡️

### The Colorblind Simulator That Made Me Gasp

```typescript
// This is in ScriptHammer RIGHT NOW
<ColorblindFilter mode="protanopia" />  // Red-blind
<ColorblindFilter mode="deuteranopia" /> // Green-blind
<ColorblindFilter mode="tritanopia" />   // Blue-blind
<ColorblindFilter mode="achromatopsia" /> // Complete colorblind
```

I turned on protanopia mode. Half my UI became invisible. _HALF._

### The Font Scaler That Grandma Loves

My 72-year-old beta tester said: "Finally, an app I don't need my glasses for!"

```typescript
// AccessibilityContext.tsx - already in your app
const fontScales = {
  'text-xs': 0.75, // Tiny
  'text-sm': 0.875, // Small
  'text-base': 1, // Normal
  'text-lg': 1.25, // Large
  'text-xl': 1.5, // Larger
  'text-2xl': 2, // Huge
  'text-3xl': 2.5, // MEGA
};

// Users just click + or - buttons
// EVERYTHING scales. Consistently.
```

### Line Height for Dyslexic Readers

Did you know tight line spacing makes text harder to read for dyslexic users?

```typescript
// Also in AccessibilityContext
const lineHeights = {
  'leading-tight': 1.25, // Default
  'leading-snug': 1.375, // Better
  'leading-normal': 1.5, // Good
  'leading-relaxed': 1.625, // Great
  'leading-loose': 2, // Maximum readability
};
```

One dropdown. Every text element adjusts. Jake's dyslexic sister loves it.

## Real Stories from Real Users 👥

### Sarah (Low Vision)

"I usually need to zoom to 200% on websites. ScriptHammer's font scaling means I can actually use it normally."

### Marcus (Deuteranopia - Red/Green Colorblind)

"The colorblind filter shows developers what I actually see. The icons and patterns make everything clear."

### Amy (Dyslexia)

"The line height option! Nobody does this! I can finally read long articles without getting lost."

### David (Motor Impairment)

"Large click targets, keyboard navigation that makes sense, and focus indicators I can actually see."

## The Skip Link Secret 🏃

You know what sucks? Tabbing through 47 navigation items to get to the content.

```tsx
// ScriptHammer's Skip Link (already there!)
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4"
>
  Skip to main content
</a>
```

Screen reader users rejoice. Keyboard navigators save 30 seconds per page.

## The Colorblind Testing Workflow 🧪

Here's how I test now:

```bash
# 1. Start your dev server
docker compose up

# 2. Open accessibility panel (already in ScriptHammer)
# Click the a11y icon in the nav

# 3. Try each filter:
- Protanopia (1 in 12 men have this!)
- Deuteranopia (most common)
- Tritanopia (rare but important)
- Achromatopsia (complete colorblindness)

# 4. Can you still use your app?
# If no, you've got work to do.
```

## The ARIA Labels That Actually Matter 🏷️

ScriptHammer components come with proper ARIA labels:

```tsx
// Bad (what I used to do)
<div onClick={handleClick}>❤️</div>

// Good (what ScriptHammer does)
<button
  aria-label="Like this post"
  onClick={handleClick}
>
  ❤️
</button>
```

Screen reader: "Like this post, button"
vs
Screen reader: "Heart emoji" (???)

## The Focus Management Magic ✨

Ever lose focus when a modal opens? ScriptHammer doesn't:

```typescript
// Modal component handles everything
const Modal = () => {
  useEffect(() => {
    // Save current focus
    const previousFocus = document.activeElement;

    // Focus first focusable element in modal
    modalRef.current?.focus();

    // Trap focus in modal
    trapFocus(modalRef.current);

    return () => {
      // Restore focus when closed
      previousFocus?.focus();
    };
  }, []);
};
```

Your keyboard users will literally thank you.

## The "Aha!" Moments 💡

### Moment 1: Color Isn't Everything

```tsx
// Bad
<span className="text-green-500">✓ Success</span>
<span className="text-red-500">✗ Error</span>

// Good (ScriptHammer way)
<span className="text-success">✓ Success</span>
<span className="text-error">⚠ Error</span>
// Different icons! Text labels! Patterns!
```

### Moment 2: Touch Targets Matter

```tsx
// Tiny checkbox = frustrated users
<input type="checkbox" className="w-4 h-4" />

// ScriptHammer = happy fingers
<label className="flex items-center p-2 cursor-pointer">
  <input type="checkbox" className="checkbox" />
  <span className="ml-2">Option</span>
</label>
// Entire label is clickable!
```

### Moment 3: Keyboard Navigation Is Not Optional

```tsx
// Every interactive element in ScriptHammer
tabIndex={0}  // Keyboard accessible
onKeyDown={handleKeyboard}  // Space/Enter work
aria-label={description}  // Screen reader friendly
role="button"  // Semantic meaning
```

## The Compliance Checklist ✅

ScriptHammer hits these out of the box:

- ✅ WCAG 2.1 Level AA compliant
- ✅ Section 508 compliant
- ✅ ADA compliant
- ✅ EN 301 549 compliant (European)
- ✅ JIS X 8341 compliant (Japanese)

Your legal team sleeps better at night.

## The Testing Suite That Catches Issues 🧪

```bash
# Run accessibility tests
docker compose exec scripthammer pnpm test:a11y

# Pa11y CI checks every page
# - Color contrast
# - ARIA labels
# - Heading structure
# - Alt text
# - Focus management
```

Catches issues before Jake has to tell you about them.

## The Bottom Line 🎯

My friend Jake can use my app now.

So can his colorblind brother, his dyslexic sister, and his grandma who refuses to wear glasses.

ScriptHammer didn't just fix my green button problem. It fixed problems I didn't even know I had.

**Every user deserves to use your app.**

ScriptHammer makes sure they can.

---

_P.S. - Jake's favorite feature? The colorblind simulator. He uses it to show people what he sees every day._

_P.P.S. - Test your app with a screen reader. Just once. It's enlightening. And humbling._
