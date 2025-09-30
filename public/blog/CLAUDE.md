# ScriptHammer Blog Writing Style Guide

This guide ensures consistency across all blog posts and technical documentation.

## Core Principle: Accessibility First

**Never assume readers know what acronyms mean.** Always explain technical terms and acronyms on first use, even if they seem common in our field.

## Acronym Guidelines

### The Pattern

On **first use**, write the full term followed by the acronym in parentheses:

```markdown
✅ GOOD: Progressive Web App (PWA)
✅ GOOD: Test-Driven Development (TDD)
✅ GOOD: Server-Side Rendering (SSR)

❌ BAD: PWA support included
❌ BAD: Use TDD approach
❌ BAD: Avoid SSR hydration issues
```

After first use, use the acronym freely:

```markdown
✅ GOOD:
Progressive Web App (PWA) support with offline capabilities via Workbox.
The PWA includes service worker registration and manifest configuration.

❌ BAD:
PWA support with offline capabilities. The PWA includes...
```

### Common Technical Acronyms to Define

Always explain these on first use:

- **API** - Application Programming Interface
- **CI/CD** - Continuous Integration/Continuous Deployment
- **CMS** - Content Management System
- **CSS** - Cascading Style Sheets
- **CTA** - Call To Action
- **E2E** - End-to-End (testing)
- **GDPR** - General Data Protection Regulation
- **HTML** - HyperText Markup Language
- **MVP** - Minimum Viable Product
- **OG** - Open Graph (social sharing metadata)
- **PWA** - Progressive Web App
- **SEO** - Search Engine Optimization
- **SSR** - Server-Side Rendering
- **CSR** - Client-Side Rendering
- **TDD** - Test-Driven Development
- **UI/UX** - User Interface / User Experience
- **WCAG** - Web Content Accessibility Guidelines

### Project-Specific Acronyms

ScriptHammer-specific terms that need explanation:

- **PRP** - Product Requirements Prompt
- **FR** - Functional Requirement (e.g., FR-001)
- **NFR** - Non-Functional Requirement (e.g., NFR-001)
- **SM** - Success Metric (e.g., SM-001)

## Examples from Existing Posts

### Good Example: scripthammer-intro.md

```markdown
- **[Tailwind CSS](https://tailwindcss.com/) (Cascading Style Sheets) v4**
- **WCAG (Web Content Accessibility Guidelines) 2.1 AA compliance ready**
- **E2E (End-to-End) testing (40+ tests)**
- **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) for local data storage**
```

### Pattern to Follow

```markdown
# First mention

Progressive Web App (PWA) support with offline capabilities.

# Subsequent mentions

The PWA includes service worker registration...
Configure your PWA manifest...
```

## Writing Tone

### Concise but Complete

- **Be direct**: Get to the point quickly
- **Be thorough**: Don't skip important details
- **Be accessible**: Explain technical concepts clearly

### Avoid Assumptions

```markdown
✅ GOOD: "Server-Side Rendering (SSR) generates HTML on the server before sending to the client."

❌ BAD: "Use SSR for better performance."
```

### Use Active Voice

```markdown
✅ GOOD: "The component renders the countdown timer."
❌ BAD: "The countdown timer is rendered by the component."
```

## Code Examples

### Always Provide Context

````markdown
✅ GOOD:
**Timer Logic**: Calculate milliseconds to Jan 1st midnight (local timezone), convert to days/hours/minutes/seconds with modulo math

```tsx
const calculateTimeLeft = () => {
  const targetDate = new Date(new Date().getFullYear() + 1, 0, 1);
  // ...
};
```
````

❌ BAD:

```tsx
const calculateTimeLeft = () => {
  // code without explanation
};
```

````

### Inline Comments for Key Concepts

When code demonstrates an important concept, add inline comments:

```tsx
✅ GOOD:
const [mounted, setMounted] = useState(false); // Avoid SSR hydration mismatch

✅ GOOD:
return () => clearInterval(timer); // Cleanup prevents memory leaks
````

## Section Headings

### Use Clear, Descriptive Headings

```markdown
✅ GOOD: "## 5. The Code (TDD: Tests First, Then Implementation)"
✅ GOOD: "## Why Countdown Timers Work"

❌ BAD: "## Code"
❌ BAD: "## Implementation"
```

## Links and References

### Always Link Technical Terms on First Use

```markdown
✅ GOOD: **[Next.js](https://nextjs.org/) 15.5.2** with App Router
✅ GOOD: **[Vitest](https://vitest.dev/)** for unit tests

❌ BAD: Next.js 15.5.2 with App Router
```

## Consistency Checklist

Before publishing, verify:

- [ ] All acronyms explained on first use
- [ ] Technical terms linked to documentation
- [ ] Code examples have inline comments for key concepts
- [ ] Headings are descriptive
- [ ] Active voice used throughout
- [ ] No assumptions about reader's technical knowledge
- [ ] Reading time appropriate for content depth

## Word Count Guidelines

Target reading times based on content type:

- **Quick Tips**: 3-5 min (500-1,000 words)
- **Tutorials**: 7-12 min (1,200-2,500 words)
- **Deep Dives**: 15-20 min (3,000-4,000 words)

Don't sacrifice clarity for brevity. Better to be thorough than terse.

---

_Last updated: 2025-09-30_
