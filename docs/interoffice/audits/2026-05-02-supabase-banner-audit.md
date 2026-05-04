# SetupBanner audit against issue #24

**Date:** 2026-05-02
**Issue:** [#24 — Gap-Audit] 006 Template Fork: add Supabase missing-config first-run banner
**Auditor:** Track C of `~/.claude/plans/gleaming-kitten-execution.md`
**Method:** Code review only (no live env-var manipulation)

## TL;DR

The Supabase missing-config banner #24 asks for **already exists**. It's
shipped as `SetupBanner` at `src/components/SetupBanner/SetupBanner.tsx`,
follows the 5-file pattern, has tests + Storybook + a11y tests, auto-detects
missing config via `isSupabaseConfigured()`, and is mounted globally in the
root layout at `src/app/layout.tsx:128`.

What the ticket asks for that does _not_ yet exist: documentation that the
banner is intentional, message-copy that names the env vars, and a
`docsUrl` that lands somewhere useful. These are small fixes (~1 day),
worth doing before closing #24.

## What exists today

### Component

- **Path:** `src/components/SetupBanner/SetupBanner.tsx` (115 LOC)
- **5-file pattern:** ✓ all 5 files present (`index.tsx`, `SetupBanner.tsx`, `SetupBanner.test.tsx`, `SetupBanner.stories.tsx`, `SetupBanner.accessibility.test.tsx`)
- **Auto-detection:** uses `isSupabaseConfigured()` from `src/lib/supabase/client.ts:107`, which returns `false` when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing
- **Dismissibility:** ✓ via `sessionStorage`, key `supabase_setup_banner_dismissed`
- **A11y:** ✓ `role="alert"`, `aria-live="polite"`, `aria-label` on dismiss button, `aria-hidden` on decorative SVGs
- **SSR-safe:** ✓ starts with `isDismissed=true` to avoid flash; only renders client-side after `useEffect`

### Wiring

- **Mounted in:** `src/app/layout.tsx:128` — inside the `AuthProvider` /
  `AccessibilityProvider` tree, between `<CountdownBanner />` and the page
  `<ErrorBoundary>`. Renders on **every page** in the app.

### Behavior summary

- Supabase configured → banner hidden (correct)
- Supabase missing → banner appears at top of every page until dismissed
- After dismissal → hidden for the rest of the browser session

## Gaps against #24's intent

### Gap 1 — Default message doesn't name the env vars

Current default (`SetupBanner.tsx:23`):

> "Supabase is not configured. Some features may be unavailable."

A fresh fork user reading this doesn't know **which** env vars to set or
where to find them. The message could name them inline:

> "Supabase is not configured: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your `.env` file."

This costs nothing — the existing layout supports the longer copy
(`<span>{message}</span>` + setup-guide link).

### Gap 2 — `docsUrl` default lands on a missing anchor

Current default (`SetupBanner.tsx:24`):

```
https://github.com/TortoiseWolfe/ScriptHammer#supabase-setup
```

GitHub returns HTTP 200 for any anchor (the page loads regardless), but
the `#supabase-setup` fragment doesn't match any heading in the current
README. The closest heading is
`### 📝 Optional - Supabase Admin (for migrations)` at line 165, which
slugifies to `optional---supabase-admin-for-migrations`.

The actual setup guide lives in `docs/FORKING.md`, section "Supabase Setup"
at line 159. Two candidate fixes:

- Point `docsUrl` at `docs/FORKING.md#supabase-setup` on GitHub
- Or add a `## Supabase Setup` heading to README.md with a brief
  "see docs/FORKING.md for details" pointer, so the existing anchor works

The second option is more discoverable for fork users who land on the
README first.

### Gap 3 — FORKING.md doesn't mention the auto-banner

`docs/FORKING.md` "Supabase Setup" section (lines 159-184) walks the user
through:

1. Create Supabase project
2. Add env vars
3. Run database migrations
4. Add GitHub Secrets

It never mentions that an in-app banner will appear automatically when
env vars are missing, what it looks like, or that it disappears once the
vars are set. A fork user encountering the yellow alert on every page
might think it's a bug.

Add one short paragraph at the top of section 159, before "1. Create
Supabase Project":

> While Supabase env vars are unset, you'll see a yellow "Setup required"
> banner on every page of the running app. This is intentional — it
> disappears automatically once `NEXT_PUBLIC_SUPABASE_URL` and
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` are populated. The banner is also
> dismissible via the × button if you want to focus on non-Supabase
> features first.

### Gap 4 — Banner shows on pages that don't need Supabase

The banner currently renders in the root layout, so it appears on the
homepage, about pages, and any other route that doesn't actually depend
on Supabase. A fork user who _intentionally_ doesn't use Supabase (e.g.,
forking ScriptHammer as a static-marketing-site template and ripping out
auth) sees the warning permanently.

This is **arguably out of scope for #24** — the ticket asks for "any
page that depends on Supabase" but the implemented behavior is "any
page, period." Two ways to handle:

- **Treat as a separate issue.** Selective rendering is a design
  decision (which pages opt in, how they signal it) that warrants its
  own spec. Close #24 with the message + docs fixes; open a follow-up
  issue for selective rendering if/when a fork user actually complains.
- **Fix in this PR.** Add an opt-in pattern: pages that need Supabase
  declare it, and `SetupBanner` only renders when at least one such
  page is mounted. Implementation cost: moderate (context provider or
  route-level metadata).

Recommendation: **defer Gap 4 to a follow-up issue.** The current
behavior (banner everywhere) is harmless once dismissed and the audit
should not turn into a refactor.

## Recommendation for closing #24

Run the SpecKit flow on the three small gaps (1, 2, 3), ship as one PR,
close #24 referencing it. Out of scope for this PR: Gap 4
(selective rendering), which gets a fresh ticket.

PRP outline for the SpecKit run:

```
Title: Supabase missing-config banner — message clarity + docs cross-reference
Scope:
  - Update SetupBanner default `message` to name NEXT_PUBLIC_SUPABASE_URL
    and NEXT_PUBLIC_SUPABASE_ANON_KEY
  - Update SetupBanner default `docsUrl` to point at docs/FORKING.md
    Supabase Setup section, OR add a #supabase-setup anchor to README.md
    that redirects there
  - Add an "auto-banner" paragraph at the top of FORKING.md Supabase
    Setup section
Tests:
  - Update existing SetupBanner tests for new default copy
  - No new components or wiring
Out of scope:
  - Selective rendering (Gap 4) — separate ticket if needed
```

## Related files

- `src/components/SetupBanner/SetupBanner.tsx` (component to update)
- `src/components/SetupBanner/SetupBanner.test.tsx` (test snapshots to update)
- `src/lib/supabase/client.ts:107` (`isSupabaseConfigured()` — no change needed)
- `src/app/layout.tsx:128` (wiring — no change needed)
- `docs/FORKING.md:159` (section to amend)
- `README.md:165` (optional anchor addition)

## Verification of audit method

This audit was performed by code review only. The live behavior was not
exercised because Supabase is currently configured in `.env`, which would
require destructive env-var manipulation to test. The existing
`SetupBanner.test.tsx` and `SetupBanner.accessibility.test.tsx` files
exercise the missing-config code path with mocks — those tests are the
authoritative source for "does the banner render correctly when env vars
are missing."

Live verification (when Gap 1–3 fixes are implemented) should:

1. Comment out `NEXT_PUBLIC_SUPABASE_*` in `.env`
2. Restart dev server
3. Confirm banner appears with new copy naming the env vars
4. Click "View setup guide" link — verify it lands on FORKING.md Supabase Setup
5. Restore env vars, confirm banner disappears
