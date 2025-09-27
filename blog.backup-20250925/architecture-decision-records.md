---
title: 'Why We Built It This Way (And Not That Other Way Everyone Suggested)'
slug: 'architecture-decision-records'
excerpt: 'The meeting that made me document every architectural decision, and how ADRs saved our sanity.'
author: 'TortoiseWolfe'
publishDate: 2025-11-04
status: 'published'
featured: false
categories:
  - Architecture
  - Documentation
  - Best Practices
tags:
  - adr
  - architecture
  - documentation
  - decisions
readTime: 9
ogImage: '/blog-images/2025-11-04-architecture-decision-records.png'
---

# Why We Built It This Way (And Not That Other Way Everyone Suggested)

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Meeting That Started It All 🏢

Picture this: Architecture review meeting. 10 developers. 47 opinions.

"We should use Redux!"
"No, Zustand is better!"
"Context is enough!"
"What about MobX?"
"Have you considered Recoil?"

Two hours later. No decision. Everyone frustrated.

Six months later. New developer joins.

"Why are we using Context for state management?"

_Awkward silence._

"I... I think Tom wanted it?"
"No, that was Sarah's idea."
"Actually, I wanted Redux..."

Nobody remembers. Nobody documented it. Nobody knows if it was the right choice.

That's why ScriptHammer uses Architecture Decision Records (ADRs).

Every. Single. Decision. Documented.

## The ADR That Saved Our Sanity 📝

Here's an actual ADR from ScriptHammer:

```markdown
# ADR-004: Static Site Generation Over Server-Side Rendering

## Status

Accepted

## Context

We need to choose between SSG, SSR, or CSR for ScriptHammer.

Everyone had opinions:

- "SSR for SEO!"
- "CSR for simplicity!"
- "ISR for best of both!"

## Decision

We chose Static Site Generation (SSG).

## Consequences

### Positive

✅ Zero hosting costs (GitHub Pages)
✅ Fastest possible performance
✅ Perfect SEO scores
✅ No server to maintain

### Negative

❌ No real-time data without client fetch
❌ Build time increases with content
❌ Dynamic routes need client-side handling

## Alternatives Considered

- **SSR with Vercel**: $20/month, added complexity
- **CSR only**: Poor SEO, slow initial load
- **ISR**: Requires Vercel/Netlify, costs money

## Date

2024-09-15

## Revisit

If we need real-time features or build times exceed 10 minutes.
```

**Six months later, nobody asks why. It's documented.**

## The Problems ADRs Solve (That You Didn't Know You Had) 🎯

### Problem 1: "Why Did We Choose Docker?"

**Without ADR**:
"I think it was for consistency?"
"Maybe for the CI/CD?"
"Tom really liked Docker..."

**With ADR**:

```markdown
# ADR-003: Docker-First Development

## Context

Half the team uses Mac, half uses Windows.
Node versions everywhere from 14 to 20.
Setup takes new developers 2 days.

## Decision

Mandatory Docker for all development.

## Why Not Alternatives

- **"Just use nvm"**: Doesn't solve OS differences
- **"Everyone use Mac"**: Not everyone has $3000
- **"Deal with it"**: We tried. It sucked.
```

### Problem 2: The Eternal Debate Settler

"We should switch to Vite!"

_Opens ADR-007_

"We evaluated Vite 3 months ago. See ADR-007 for why we stayed with Next.js."

Debate over. Time saved. Feelings intact.

### Problem 3: The New Developer Accelerator

New dev: "This architecture seems weird..."

You: "Read ADRs 001 through 010."

_30 minutes later_

New dev: "Oh, now it makes perfect sense! And I agree with the decisions."

## The ADR Template That Actually Gets Used 📋

ScriptHammer's template (simple = used):

```markdown
# ADR-XXX: [Decision Title]

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-YYY]

## Context

What problem are we solving?
What constraints exist?
Who's affected?

## Decision

What are we doing?

## Consequences

### Positive

- ✅ Good thing 1
- ✅ Good thing 2

### Negative

- ❌ Bad thing 1
- ❌ Trade-off 1

## Alternatives Considered

- **Option A**: Why we didn't choose it
- **Option B**: Why this won't work

## Date

YYYY-MM-DD

## Revisit

When should we reconsider?
```

**Takes 10 minutes to write. Saves 10 hours of meetings.**

## Real ADRs from ScriptHammer (The Juicy Ones) 🔥

### ADR-002: 5-File Component Pattern

```markdown
## Context

Every developer structures components differently.
PR reviews are chaos. "Where are the tests?"

## Decision

EVERY component MUST have 5 files:

- index.tsx
- Component.tsx
- Component.test.tsx
- Component.stories.tsx
- Component.accessibility.test.tsx

## Consequences

✅ Consistency across 100+ components
✅ Tests are never "forgotten"
❌ More boilerplate for simple components
❌ Some devs think it's overkill

## Alternative: "Let developers choose"

Result: Chaos. Been there. Hated it.
```

### ADR-005: No Redux (The Controversial One)

```markdown
## Context

Everyone expects Redux. It's the "default."

## Decision

No Redux. Context + hooks only.

## Why This Upset People

- "But Redux is industry standard!"
- "How will we manage complex state?"
- "This won't scale!"

## Why We Did It Anyway

- No external dependency
- 90% less boilerplate
- React's built-in solution
- We're not building Facebook

## Revisit

If we need time-travel debugging or have 50+ actions.
(Narrator: We never did.)
```

### ADR-006: TypeScript Strict Mode From Day One

```markdown
## Context

"We can enable strict mode later"

- Every project ever (who never does)

## Decision

Strict mode. Day one. No exceptions.

## The Pain We Accepted

- Red squiggles everywhere initially
- Slower initial development
- Some developers complaining

## The Pain We Avoided

- Runtime TypeErrors
- "Cannot read property of undefined"
- 3 AM production fires
- The migration that never happens

## Quote from Future Us

"Thank God we did this from the start"
```

## The ADR Lifecycle (How Decisions Evolve) 🔄

### Stage 1: Proposed

```markdown
# ADR-015: Migrate to Bun

## Status

Proposed // Just an idea

## Context

Bun is 10x faster than Node...
```

### Stage 2: Accepted

```markdown
## Status

Accepted // We're doing this

## Decision

Stay with Node for now because...
```

### Stage 3: Deprecated

```markdown
## Status

Deprecated // Don't follow this anymore

## Note

See ADR-022 for current approach
```

### Stage 4: Superseded

```markdown
## Status

Superseded by ADR-030 // Replaced

## Note

We changed our mind because...
```

## The Hidden Benefits Nobody Talks About 💎

### Benefit 1: Onboarding Magic

New developer reads 10 ADRs. Understands entire architecture philosophy. Productive on day 2.

### Benefit 2: Decision Confidence

"Did we make the right choice?"
Check ADR. See all alternatives considered. Feel better.

### Benefit 3: Meeting Ender

"Should we switch to GraphQL?"
"See ADR-009."
Meeting over in 5 minutes instead of 2 hours.

### Benefit 4: CYA Documentation

"Why did you choose this terrible approach?"
_Forwards ADR with 6 stakeholder approvals_
"We all agreed."

## The ADRs You Should Write Today ✍️

1. **Build Tool Choice** (Webpack vs Vite vs Turbopack)
2. **State Management** (Redux vs Context vs Zustand)
3. **CSS Strategy** (CSS-in-JS vs Tailwind vs Modules)
4. **Testing Approach** (Jest vs Vitest, E2E strategy)
5. **Component Structure** (Atomic Design vs Feature folders)
6. **API Design** (REST vs GraphQL vs tRPC)
7. **Deployment Target** (Vercel vs AWS vs Self-hosted)

## How to Start ADRs in Your Project 🚀

```bash
# Create ADR directory
mkdir docs/adrs

# Copy ScriptHammer's template
curl -O https://raw.githubusercontent.com/ScriptHammer/templates/adr-template.md

# Write your first ADR
echo "# ADR-001: We Are Using ADRs" > docs/adrs/001-using-adrs.md

# Commit it
git add docs/adrs
git commit -m "Add first ADR"
```

## The Bottom Line 📊

Six months from now, someone will ask "Why?"

Without ADRs: 🤷‍♂️ "I don't remember"

With ADRs: 📖 "See ADR-007, section 3"

Your future self will thank you.

Your team will thank you.

The new developer will thank you.

That's why ScriptHammer documents every decision.

Because "I think Sarah wanted it that way" is not documentation.

---

_P.S. - Yes, writing ADRs takes time. Explaining decisions six months later takes more time._

_P.P.S. - Start with ONE ADR. Just one. About your most controversial decision. Watch the debates disappear._
