# Positioning: a product first, a template second

ScriptHammer is a real, deployed product that happens to also be forkable. Both halves are true, and this note says which leads and why — so the README, and anyone evaluating the repo, reads it accurately.

## It's a deployed product

Running live at [scripthammer.com](https://www.scripthammer.com/), not just a repo:

- **Auth** — email/password plus GitHub and Google OAuth via Supabase, protected routes, session management.
- **Payments** — Stripe one-time and PayPal subscriptions through Supabase Edge Functions, GDPR consent flow, webhook handling with idempotency.
- **Encrypted messaging** — end-to-end encrypted direct and group chat with ECDH key exchange, real-time over Supabase.
- **Admin surface** — admin dashboard, moderation queue, security audit trail.
- **Offline PWA** — installable, service-worker offline support, background sync, Lighthouse PWA score in the 90s.
- **Accessibility & privacy** — WCAG AA, colorblind assistance, font switching, GDPR consent gating analytics.

Backed by ~900 source files, ~130 test files, and roughly 49 tracked SpecKit features, with Vitest, Playwright (cross-browser), and Pa11y suites running in CI. This is a production system, not a tutorial.

## It's also a template

Forking is a real, supported feature, not the headline:

- `scripts/rebrand.sh` — a 600+ line script that rebrands 200+ files in five minutes (name, owner, theme, docker service, env example), with `--dry-run`, CI-friendly exit codes, and already-rebranded detection.
- `docs/FORKING.md`, `docs/FORK-CHECKLIST.md`, `docs/TEMPLATE-GUIDE.md` — the fork onboarding path.
- A Plop component generator enforcing the five-file atomic component pattern.

## Why product-first framing is honest

The substance was always there; the README just used to lead with the fork affordance ("Modern Next.js Template," "starter kit," the "Use this template" badge in the hero), which undersold the deployed product. Leading with the product and keeping forking as a clearly-labeled secondary path is the accurate ordering. Nothing about the fork capability is hidden or removed — a reader still finds the rebrand script and the fork docs, they're just no longer the first thing.

See README issue #152 for the repositioning rationale.
