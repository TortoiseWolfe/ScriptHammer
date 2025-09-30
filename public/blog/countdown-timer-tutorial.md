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
ogImage: /blog-images/countdown-timer-tutorial/countdown-banner-og.svg
ogTitle: Build a Countdown Timer - PRP/SpecKit Tutorial
ogDescription: Learn the PRP/SpecKit workflow by building a countdown timer. From requirements to production code.
twitterCard: summary_large_image
---

# From Template to Client: Building Landing Pages That Convert

## The Landing Page Strategy

ScriptHammer isn't just a Next.js template—it's your **entry point** to client relationships.

**The Pitch**: "I'll customize this production-ready template for your domain on GitHub Pages. $321/year. 12 hours of my time annually."

That's **$27/month** for a professional landing page with:

- Theme customization (most brands just pick light/dark, though ScriptHammer includes 32 themes)
- Progressive Web App (PWA) capabilities (offline support)
- Contact forms + calendar booking
- Search Engine Optimization (SEO)-optimized blog
- Mobile-responsive, accessible

**The Business Model**: 4 hours initial setup + 8 hours quarterly updates = your foot in the door. When they need a Content Management System (CMS), e-commerce, or custom features—you're their trusted webmaster with recurring revenue + upsell pipeline.

## Why Countdown Timers Work

Countdown timers increase conversions by 8-12%. But fake urgency erodes trust. If you say it ends at midnight January 1st, it **must disappear** at midnight January 1st.

Let's build a real countdown timer using **Product Requirements Prompt (PRP) → SpecKit workflow**.

---

# Part 1: The PRP (Product Requirements Prompt)

A Product Requirements Prompt (PRP) focuses on **what users need**, not how to build it. The `/specify` command reads your PRP and searches the codebase to determine technical approach. PRPs have 3 core sections focusing on product requirements:

## 1. Product Requirements

**What**: Countdown banner showing time until January 1st midnight, promoting "$321/year Custom Setup", linking to `/schedule`

**Why**: Drive conversions (8-12% boost), demonstrate capability, capture high-intent leads

**Success Criteria**: Accurate to the second, disappears at midnight, tracks dismissals, mobile responsive, accessible, no Server-Side Rendering (SSR) hydration issues

**Out of Scope**: Payment processing, discount codes, email automation, analytics, A/B testing (Minimum Viable Product/MVP)

## 2. Context & Codebase Intelligence

**Reuse Existing**:

- Button component (`@/components/atomic/Button`)
- Calendar integration (`/schedule` page already exists)
- Layout file (`src/app/layout.tsx`) - we'll add the banner below the header

**No New Dependencies**: Use native browser Application Programming Interfaces (APIs)

## 3. Implementation Runbook

**SpecKit Workflow** (PRP → Spec → Plan → Tasks → Implement):

```bash
# 1. Create feature branch
./scripts/prp-to-feature.sh countdown-timer 016

# 2. Generate SpecKit spec (tell Claude)
/specify New Year's countdown banner with $321/year offer

# 3. Generate implementation plan
/plan Use native Date, localStorage, integrate into layout

# 4. Generate task list
/tasks Focus on Test-Driven Development (TDD) approach

# 5. Generate component scaffold
docker compose exec scripthammer pnpm run generate:component CountdownBanner atomic
```

**Generated Artifacts**: SpecKit creates `spec.md` (Given/When/Then, Functional Requirements/FR-001+, Non-Functional Requirements/NFR-001+), `plan.md` (technical specs), `research.md`, `data-model.md`, `tasks.md`

---

# Part 2: The Code (From SpecKit to Production)

After running the SpecKit workflow, `/plan` generates technical specifications like state management, timer logic, and rendering approach. Now we implement:

**Tests** (`CountdownBanner.test.tsx`):

```tsx
describe('CountdownBanner', () => {
  it('renders countdown correctly', () => {
    vi.setSystemTime(new Date('2025-12-31T23:00:00'));
    render(<CountdownBanner />);
    expect(screen.getByText(/1d/)).toBeInTheDocument();
  });

  it('returns null after midnight', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:01'));
    const { container } = render(<CountdownBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('persists dismissal', async () => {
    render(<CountdownBanner />);
    screen.getByLabelText(/dismiss/i).click();
    await waitFor(() =>
      expect(localStorage.getItem('countdown-dismissed-2026')).toBe('true')
    );
  });
});
```

**Component** (`CountdownBanner.tsx` - full code, inline comments explain key concepts):

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atomic/Button';

const DISMISS_KEY = 'countdown-dismissed-2026'; // Year-specific resets annually

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
    setIsDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
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
      className="alert alert-warning sticky top-0 z-50"
      role="banner"
      aria-live="polite"
    >
      <div className="flex flex-1 flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏰</span>
          <div>
            <span className="font-bold">New Year Special</span>
            <div className="countdown font-mono text-2xl">
              <span style={{ '--value': timeLeft.days } as any}>
                {timeLeft.days}
              </span>
              d
              <span style={{ '--value': timeLeft.hours } as any}>
                {timeLeft.hours}
              </span>
              h
              <span style={{ '--value': timeLeft.minutes } as any}>
                {timeLeft.minutes}
              </span>
              m
              <span style={{ '--value': timeLeft.seconds } as any}>
                {timeLeft.seconds}
              </span>
              s
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
            localStorage.setItem(DISMISS_KEY, 'true');
            setIsDismissed(true);
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

**Integration** (`src/app/layout.tsx`):

```tsx
import { CountdownBanner } from '@/components/atomic/CountdownBanner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Header />
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
docker compose exec scripthammer pnpm run test:suite
docker compose exec scripthammer pnpm run build
```

---

# Part 3: Validation & Next Steps

**Validation**: Test-Driven Development (TDD) (tests first), 5-file pattern, mobile tested, accessibility verified, cross-browser, Lighthouse check

**Key Technical Considerations** (from `/plan`):

- **Timezone**: Use `new Date(year + 1, 0, 1)` (local) not UTC string
- **SSR Mismatch**: Don't render until `mounted` (see code)
- **Memory Leak**: Return `() => clearInterval(timer)` in useEffect
- **localStorage**: Wrap in try/catch for Safari private mode

**References**: PRP Methodology (`docs/prp-docs/`), SpecKit Guide, Component Generator, DaisyUI Countdown, React docs, MDN (localStorage, ARIA)

---

# What You've Learned

**Technical**: React hooks, TypeScript, TDD, responsive design, Web Application Programming Interfaces (APIs) (localStorage, Date, setInterval)

**Process**: PRP methodology, SpecKit workflow (/specify → /plan → /tasks → /implement), 5-file component pattern

**Business**: $321/year landing page service, conversion optimization, sales funnel, recurring revenue

## Next Steps

**Customize**: Edit price, CTA text, target date in code

**Test**: `docker compose exec scripthammer pnpm run test:suite && pnpm run build`

**Deploy**: `git add . && git commit -m "feat: Countdown banner" && git push` (GitHub Actions auto-deploys)

**Track**: Add Google Analytics events, monitor click-through rate, A/B test CTA variations

**Iterate**: Test different CTA text, add social proof, consider exit-intent popup

---

## The Bigger Picture

This tutorial demonstrates **building a consulting business** using ScriptHammer:

**Your Stack**: Template + Blog + Storybook + Calendar + Contact Form = Portfolio

**Your Process**: PRP → SpecKit = Documented, repeatable, quality-assured workflow

**Your Offer**: $321/year entry point → Value ladder → Recurring revenue

Clients want proven solutions. Developers want starting points. Consultants want leverage. ScriptHammer gives you all three.

---

## Ready to Start?

✅ Production-ready countdown component
✅ Repeatable PRP/SpecKit workflow
✅ Business model for consulting
✅ Template to showcase capabilities

**Next Move**: [Fork ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer/fork) → Deploy countdown → Share on LinkedIn → Book first client

---

_This tutorial was written using the PRP/SpecKit methodology it teaches._
