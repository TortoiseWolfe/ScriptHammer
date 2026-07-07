# PRP: Supabase Missing-Config Banner — Message Clarity & Docs Cross-Reference

## Problem Statement

**Date**: 2026-05-02
**Status**: Proposed
**Priority**: P2 (Medium — fork-experience polish)
**Issue**: [#24](https://github.com/TortoiseWolfe/ScriptHammer/issues/24)
**Audit**: [`docs/interoffice/audits/2026-05-02-supabase-banner-audit.md`](../interoffice/audits/2026-05-02-supabase-banner-audit.md)

### What's already shipped

The `SetupBanner` component at `src/components/SetupBanner/SetupBanner.tsx`
exists, follows the 5-file pattern, has tests + Storybook + a11y tests,
auto-detects missing Supabase config via `isSupabaseConfigured()` from
`src/lib/supabase/client.ts:107`, and is mounted globally in the root
layout at `src/app/layout.tsx:128`. So 85% of issue #24 is already done.

### What's still missing

A fresh fork user with empty Supabase env vars sees the banner appear,
but nothing in the message or the docs explains what to do about it.
Three small gaps make the banner less useful than it could be:

1. **Default message doesn't name the env vars.** Current copy:
   _"Supabase is not configured. Some features may be unavailable."_ —
   doesn't tell the user which two `NEXT_PUBLIC_*` vars to set.
2. **`docsUrl` lands on a missing anchor.** Default points at
   `https://github.com/TortoiseWolfe/ScriptHammer#supabase-setup`,
   but no such heading exists on the README. Closest match is
   `### 📝 Optional - Supabase Admin (for migrations)` (line 165),
   which slugifies to `optional---supabase-admin-for-migrations`.
   The actual setup guide lives at `docs/FORKING.md#supabase-setup`.
3. **`docs/FORKING.md` doesn't mention the auto-banner.** Section
   "Supabase Setup" (lines 159-184) walks through project creation,
   env vars, migrations, and GitHub Secrets — but never mentions
   that an in-app banner appears automatically when env vars are
   missing. A fork user might think it's a bug.

## Requirements

### R1: Default message names the env vars

Update `SetupBanner.tsx:23` default `message` prop. New copy:

> "Supabase is not configured: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your `.env` file."

Constraint: keep within the existing single-line `<span>` layout. If
length becomes an issue on mobile, fall back to a two-line card layout
with the env-var names on the second line.

### R2: `docsUrl` lands somewhere useful

Update `SetupBanner.tsx:24` default `docsUrl` to point at the actual
setup guide. Two viable options — pick one:

- **Option A (recommended):** Point at
  `https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/FORKING.md#supabase-setup`.
  Direct, no README change needed.
- **Option B:** Add a `## Supabase Setup` heading to README.md with a
  brief "see [FORKING.md](docs/FORKING.md#supabase-setup)" pointer, so
  the existing anchor works.

A is simpler and lands the user directly on the canonical guide. B
improves README discoverability for fork users who arrive via the
README first.

### R3: FORKING.md mentions the auto-banner

Add a paragraph at the top of `docs/FORKING.md` "Supabase Setup"
section (line 159), before "1. Create Supabase Project":

> While Supabase env vars are unset, you'll see a yellow "Setup required"
> banner on every page of the running app. This is intentional — it
> disappears automatically once `NEXT_PUBLIC_SUPABASE_URL` and
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` are populated. The banner is also
> dismissible via the × button if you want to focus on non-Supabase
> features first.

### R4: Tests reflect the new defaults

Update `src/components/SetupBanner/SetupBanner.test.tsx` snapshots /
assertions for the new default message and docsUrl. No new test cases
required — the existing test surface (renders when not configured,
hides when dismissed, sessionStorage round-trip) is unchanged.

## Out of Scope

- **Selective rendering on Supabase-dependent pages only** (Gap 4 in the
  audit). The current behavior renders the banner on every page in the
  root layout. That may be the wrong default for fork users who
  intentionally don't use Supabase, but fixing it is a design decision
  (which pages opt in, how they signal it) that warrants its own spec.
  Defer to a follow-up issue if a fork user complains.
- **New components or wiring.** The component already exists. The
  layout-level mount already exists. This PRP is a string-and-docs
  change, nothing structural.
- **Localizing the banner copy.** ScriptHammer doesn't have an i18n
  story today; adding one isn't this ticket's job.

## Files Touched

- `src/components/SetupBanner/SetupBanner.tsx` — update default props
- `src/components/SetupBanner/SetupBanner.test.tsx` — update default-prop assertions
- `src/components/SetupBanner/SetupBanner.stories.tsx` — verify Storybook stories still render with new copy (likely no change needed if stories use explicit props rather than defaults)
- `docs/FORKING.md` — add auto-banner paragraph at line 159
- _(if Option B chosen)_ `README.md` — add `## Supabase Setup` heading

## Verification

1. **Unit tests pass:** `docker compose exec scripthammer pnpm test SetupBanner`
2. **A11y tests pass:** `docker compose exec scripthammer pnpm test SetupBanner.accessibility`
3. **Live verification with missing config:**
   - Comment out `NEXT_PUBLIC_SUPABASE_*` in `.env`
   - `docker compose restart scripthammer`
   - Load any page; banner appears with the new copy naming the env vars
   - Click "View setup guide" — lands on `docs/FORKING.md` Supabase Setup
   - Restore env vars; restart; banner disappears
4. **Storybook:** `docker compose exec scripthammer pnpm run storybook` —
   confirm `SetupBanner` stories still render correctly
5. **Constitution gates:** 5-file structure intact, type-check passes,
   lint passes, no host installs, all work in Docker.

## SpecKit Workflow

This PRP feeds directly into the standard SpecKit flow:

```
/speckit.specify  ← reads this PRP, produces spec.md
/speckit.clarify  ← interactive clarification (likely thin — PRP is specific)
/speckit.plan     ← produces plan.md
/speckit.checklist
/speckit.tasks    ← produces tasks.md
/speckit.analyze
/speckit.implement
```

Branch convention: `24/supabase-banner-clarity` (or whatever the
SpecKit-issued NNN slug becomes). Operator handles the push and PR
per Constitution Principle VIII.

## Estimated Effort

Half a day. Three small string changes, one doc paragraph, one test
assertion update. No new components, no new wiring, no architectural
decisions.
