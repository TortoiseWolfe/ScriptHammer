---
title: Build a Countdown Timer Tutorial
author: TortoiseWolfe
date: 2025-09-30
slug: countdown-timer-tutorial
tags:
  - tutorial
  - prp-workflow
  - react
  - typescript
  - component-development
  - conversion-optimization
  - business-strategy
categories:
  - tutorial
  - business
excerpt: Learn the PRP/SpecKit workflow by building a countdown timer. From requirements to production code with ScriptHammer template.
featuredImage: /blog-images/countdown-timer-tutorial/countdown-banner-preview.svg
featuredImageAlt: Countdown timer component showing days, hours, minutes, seconds with New Year sale promotion
ogImage: /blog-images/countdown-timer-tutorial/countdown-banner-og.png
ogTitle: Build a Countdown Timer - PRP/SpecKit Tutorial
ogDescription: Learn the PRP/SpecKit workflow by building a countdown timer. Step-by-step tutorial from requirements to production-ready code with ScriptHammer.
twitterCard: summary_large_image
linkedinAuthorUrl: https://www.linkedin.com/in/pohlner/
---

# From Template to Client: Building Landing Pages That Convert

## 🎯 The Landing Page Strategy

ScriptHammer isn't just a Next.js template—it's your **entry point** to client relationships.

**The Pitch**: "I'll customize this production-ready template for your domain on GitHub Pages. $321/year. 12 hours of my time annually."

That's **$27/month** for a professional landing page with:

- Theme customization (most brands just pick light/dark, though ScriptHammer includes 32 themes)
- Progressive Web App (PWA) capabilities (offline support)
- Contact forms + calendar booking
- Search Engine Optimization (SEO)-optimized blog
- Mobile-responsive, accessible

**The Business Model**: 4 hours initial setup + 8 hours quarterly updates = your foot in the door. When they need a Content Management System (CMS), e-commerce, or custom features—you're their trusted webmaster with recurring revenue + upsell pipeline.

## ⏱️ Why Countdown Timers Work

Countdown timers increase conversions by 8-12%. But fake urgency erodes trust. If you say it ends at midnight January 1st, it **must disappear** at midnight January 1st.

Let's build a real countdown timer using **Product Requirements Prompt (PRP) → SpecKit workflow**.

---

# Part 1: The PRP (Product Requirements Prompt)

A Product Requirements Prompt (PRP) focuses on **what users need**, not how to build it. The `/specify` command reads your PRP and searches the codebase to determine technical approach. PRPs have 3 core sections focusing on product requirements:

## 📋 1. Product Requirements

**What**: Countdown banner showing time until January 1st midnight, promoting "$321/year Custom Setup", linking to `/schedule`

**Why**: Drive conversions (8-12% boost), demonstrate capability, capture high-intent leads

**Success Criteria**: Accurate to the second, disappears at midnight, tracks dismissals, mobile responsive, accessible, no Server-Side Rendering (SSR) hydration issues

**Out of Scope**: Payment processing, discount codes, email automation, analytics, A/B testing (Minimum Viable Product/MVP)

## 🧠 2. Context & Codebase Intelligence

**Reuse Existing**:

- Button component (`@/components/atomic/Button`)
- Calendar integration (`/schedule` page already exists)
- Layout file (`src/app/layout.tsx`) - we'll add the banner below the header

**No New Dependencies**: Use native browser Application Programming Interfaces (APIs)

## 🔨 3. Implementation Runbook

**SpecKit Workflow** (PRP → Spec → Plan → Tasks → Implement):

> **Note for Readers**: Steps 2-4 require [Claude Code CLI](https://claude.com/claude-code) installed and configured. If you don't have Claude Code, skip directly to step 5 (component generation) and follow the code examples in Part 2.

```bash
# 1. Create feature branch (run from host machine)
./scripts/prp-to-feature.sh countdown-timer 016

# 2. Generate SpecKit spec (Claude Code slash command - tell Claude in the CLI)
/specify New Year's countdown banner with $321/year offer

# 3. Generate implementation plan (Claude Code slash command)
/plan Use native Date, localStorage, integrate into layout

# 4. Generate task list (Claude Code slash command)
/tasks Focus on Test-Driven Development (TDD) approach

# 5. Generate component scaffold (run in Docker container - interactive prompts)
docker compose exec scripthammer pnpm run generate:component
# You'll be prompted for:
#   - Component name: CountdownBanner
#   - Category: atomic
#   - Has props? Y
#   - Include hooks? N
```

<details>
<summary>▶️ 💡 <strong>CLICK HERE: Pro Tip - CLI Arguments for Automation</strong></summary>

**For scripting and automation:**

```bash
docker compose exec scripthammer pnpm run generate:component -- \
  --name CountdownBanner \
  --category atomic \
  --hasProps true \
  --withHooks false
```

**Available categories:** `subatomic`, `atomic`, `molecular`, `organisms`, `templates`

</details>

**Generated Artifacts** (if using Claude Code): SpecKit creates `spec.md` (Given/When/Then, Functional Requirements/FR-001+, Non-Functional Requirements/NFR-001+), `plan.md` (technical specs), `research.md`, `data-model.md`, `tasks.md`

**Without Claude Code**: Skip to step 5 and follow the code implementation in Part 2. The component generator creates the 5-file pattern scaffold:

```
CountdownBanner/
├── index.tsx                             # Barrel export (re-exports component)
├── CountdownBanner.tsx                   # Main component (implement below)
├── CountdownBanner.test.tsx              # Unit tests (see test code below)
├── CountdownBanner.stories.tsx           # Storybook stories (update after implementation)
└── CountdownBanner.accessibility.test.tsx # A11y tests (update after implementation)
```

The `index.tsx` barrel export allows you to import with `import { CountdownBanner } from '@/components/atomic/CountdownBanner'` instead of specifying the full file path.

**Note for Storybook**: When creating `CountdownBanner.stories.tsx`, use `@storybook/nextjs` for imports in Next.js projects:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs'; // Not @storybook/react
```

---

# Part 2: The Code (From SpecKit to Production)

After running the SpecKit workflow, `/plan` generates technical specifications like state management, timer logic, and rendering approach. Now we implement:

**Tests** (`CountdownBanner.test.tsx`):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Next.js router (required for useRouter hook)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { CountdownBanner } from './CountdownBanner';

describe('CountdownBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders countdown timer', () => {
    const { container } = render(<CountdownBanner />);
    // Verify timer displays format like "92d 8h 10m 35s"
    const timerText = container.textContent;
    expect(timerText).toMatch(/\d+d\s+\d+h\s+\d+m\s+\d+s/);
  });

  it('renders promotional content', () => {
    render(<CountdownBanner />);
    expect(screen.getByText('$321/year')).toBeInTheDocument();
    expect(screen.getByText('Book Now')).toBeInTheDocument();
  });

  it('persists dismissal with timestamp', () => {
    render(<CountdownBanner />);
    const dismissButton = screen.getByLabelText(/dismiss/i);
    fireEvent.click(dismissButton);
    const dismissedAt = localStorage.getItem('countdown-dismissed');
    expect(dismissedAt).toBeTruthy();
    expect(parseInt(dismissedAt!, 10)).toBeGreaterThan(Date.now() - 1000);
  });
});
```

**Component** (`CountdownBanner.tsx` - full code, inline comments explain key concepts):

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/atomic/Button';

const DISMISS_KEY = 'countdown-dismissed';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const CountdownBanner = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false); // Avoid SSR hydration mismatch
  const [isDismissed, setIsDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  // Check dismissal on mount
  useEffect(() => {
    setMounted(true);
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const timeSinceDismissal = Date.now() - parseInt(dismissedAt, 10);
        setIsDismissed(timeSinceDismissal < DISMISS_DURATION);
      }
    } catch (e) {
      // Safari private mode - user will see banner every time
      setIsDismissed(false);
    }
  }, []);

  // Calculate and update countdown
  useEffect(() => {
    if (!mounted || isDismissed) return;

    const calculateTimeLeft = () => {
      const targetDate = new Date(new Date().getFullYear() + 1, 0, 1); // Jan 1 local time
      const difference = targetDate.getTime() - new Date().getTime();

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24), // Modulo extracts remainder
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false,
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer); // Cleanup prevents memory leaks
  }, [mounted, isDismissed]);

  if (!mounted || isDismissed || timeLeft.isExpired) return null;

  return (
    <div
      className="bg-warning text-warning-content fixed top-40 right-4 z-50 max-w-xs rounded-lg p-3 shadow-xl max-sm:top-56 max-sm:right-4 max-sm:left-4 max-sm:max-w-full"
      role="banner"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏰</span>
          <div>
            <span className="font-bold">New Year Special</span>
            <div className="font-mono text-lg">
              {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m{' '}
              {timeLeft.seconds}s
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold">$321/year</div>
            <div className="text-sm">Custom ScriptHammer Setup</div>
          </div>
          <Button variant="accent" onClick={() => router.push('/schedule')}>
            Book Now
          </Button>
        </div>

        <button
          className="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, Date.now().toString());
              setIsDismissed(true);
            } catch (e) {
              // Safari private mode - just hide for session
              setIsDismissed(true);
            }
          }}
          aria-label="Dismiss countdown banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
```

> **UI Layout Note**: The banner uses `top-40 right-4` to stack vertically below blog SEO/TOC controls (at `top-20 right-4`), preventing overlap. All UI elements align to the right edge with clear hierarchy: functional controls → promotional content.

**Integration** (`src/app/layout.tsx`):

```tsx
import { CountdownBanner } from '@/components/atomic/CountdownBanner';
import { GlobalNav } from '@/components/GlobalNav';
import { Footer } from '@/components/Footer';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <GlobalNav />
        <CountdownBanner /> {/* Appears on all pages */}
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

**Validation**:

```bash
# Format code to match project style
docker compose exec scripthammer pnpm run format

# Run full test suite and build
docker compose exec scripthammer sh -c "pnpm run test:suite && pnpm run build"
```

---

# Part 3: Validation & Next Steps

**Validation**: Test-Driven Development (TDD) (tests first), 5-file pattern, mobile tested, accessibility verified, cross-browser, Lighthouse check

**Key Technical Considerations** (from `/plan`):

- **Timezone**: Use `new Date(year + 1, 0, 1)` (local) not UTC string
- **SSR Mismatch**: Don't render until `mounted` (see code)
- **Memory Leak**: Return `() => clearInterval(timer)` in useEffect
- **localStorage**: Wrap in try/catch for Safari private mode

**References**: PRP Methodology (`docs/prp-docs/`), SpecKit Guide, Component Generator, React docs, MDN (localStorage, ARIA)

---

# What You've Learned

**Technical**: React hooks, TypeScript, TDD, responsive design, Web Application Programming Interfaces (APIs) (localStorage, Date, setInterval)

**Process**: PRP methodology, SpecKit workflow (/specify → /plan → /tasks → /implement), 5-file component pattern

**Business**: $321/year landing page service, conversion optimization, sales funnel, recurring revenue

## 🚀 Next Steps

**Customize**: Edit price, CTA text, target date in code

**Test**: `docker compose exec scripthammer sh -c "pnpm run test:suite && pnpm run build"`

**Deploy**: `git add . && git commit -m "feat: Countdown banner" && git push` (GitHub Actions auto-deploys)

**Track**: Add Google Analytics events, monitor click-through rate, A/B test CTA variations

**Iterate**: Test different CTA text, add social proof, consider exit-intent popup

---

## 💡 The Bigger Picture

This tutorial demonstrates **building a consulting business** using ScriptHammer:

**Your Stack**: Template + Blog + Storybook + Calendar + Contact Form = Portfolio

**Your Process**: PRP → SpecKit = Documented, repeatable, quality-assured workflow

**Your Offer**: $321/year entry point → Value ladder → Recurring revenue

Clients want proven solutions. Developers want starting points. Consultants want leverage. ScriptHammer gives you all three.

---

## ✅ Ready to Start?

✅ Production-ready countdown component
✅ Repeatable PRP/SpecKit workflow
✅ Business model for consulting
✅ Template to showcase capabilities

**Next Move**: [Fork ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer/fork) → Deploy countdown → Share on LinkedIn → Book first client

---

_This tutorial was written using the PRP/SpecKit methodology it teaches._
