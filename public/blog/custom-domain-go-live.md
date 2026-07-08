---
title: 'Going Live: A Static Next.js App on a Custom Domain'
author: TortoiseWolfe
date: 2026-07-08
slug: custom-domain-go-live
tags:
  - deployment
  - github-pages
  - vercel
  - dns
  - nextjs
  - supabase
categories:
  - tutorials
  - workflow
excerpt: A step-by-step runbook for taking a static Next.js PWA from a project URL to a custom domain — choosing among domains you own, GitHub Pages vs Vercel, DNS, the basePath drop, and the Supabase auth-redirect gotcha that will bite you.
featuredImage: /blog-images/custom-domain-go-live/featured-og.svg
featuredImageAlt: Going live - taking a static Next.js app from a project URL to a custom domain
ogImage: /blog-images/custom-domain-go-live/featured-og.png
ogTitle: Going Live - A Static Next.js App on a Custom Domain
ogDescription: A runbook for taking a static Next.js PWA to a custom domain - choosing a canonical domain, GitHub Pages vs Vercel, DNS, basePath, and Supabase auth redirects.
twitterCard: summary_large_image
---

# 🚀 Going Live: A Static Next.js App on a Custom Domain

Your app has been living at a project URL — `yourname.github.io/YourApp` — and it's time to give it a real address. This is the runbook: how to go from a project URL to a custom domain for a **static-export Next.js Progressive Web App (PWA)**, without breaking authentication, the installable app, or your search-engine standing on the way.

It's written from a real go-live (a pet-adoption app called Held Paws), so the gotchas are the ones that actually bite, not the ones a generic guide warns about. Follow it top to bottom.

## 🗺️ The shape of the job

A custom-domain launch is five decisions and steps, in order — and the first is a decision, not a command:

1. **Pick your canonical domain** (especially if you own several).
2. **Choose your host** — GitHub Pages or Vercel.
3. **Point DNS + drop the basePath.**
4. **Update the auth + API redirect URLs** (the step everyone forgets).
5. **Fix the PWA manifest scope.**

Miss step 4 and sign-ups silently break the day you launch. Miss step 5 and the installed app opens to a 404. Let's go.

## 🎯 Step 1 — Pick your canonical domain

If you own one domain, skip ahead. If you own several — say `heldpaws.com`, `heldpaws.org`, `raisedpaws.com`, `raisedpaws.org` — you have a decision to make **before** you touch DNS, because everything downstream (auth redirects, Open Graph tags, analytics) needs a single source-of-truth Uniform Resource Locator (URL).

> ⚠️ **Serve the app from exactly one domain.** Serving the same content from multiple domains splits your Search Engine Optimization (SEO) — search engines see duplicate content and divide your link authority instead of compounding it — and multiplies the auth-redirect URLs you have to keep in sync. Pick one **canonical** domain; make the others redirect to it.

How to pick:

- **Brand match.** Whatever name is already in your code and copy wins on zero-friction grounds. If the app says "Held Paws" everywhere, `heldpaws.*` is canonical and `raisedpaws.*` becomes a defensive redirect.
- **`.com` vs `.org`.** `.org` signals nonprofit/mission (good trust signal for a cause or a rescue); `.com` is what people default-type. The clean rule: **match your legal status** — a registered nonprofit leads with `.org`; everyone else leads with `.com` and holds `.org` in reserve.
- **The rest become 301 redirects.** Owning all four is smart — it blocks squatters and catches typos — but _using_ all four as live sites is not. Own them all; serve from one; permanently (301) redirect the others.

For the worked example here: canonical is **`heldpaws.com`**, and `heldpaws.org` + `raisedpaws.com` + `raisedpaws.org` will 301-redirect to it.

## 🏠 Step 2 — GitHub Pages or Vercel?

Both give you a custom domain with automatic HyperText Transfer Protocol Secure (HTTPS). The difference is what your app _needs_.

**GitHub Pages** serves static files. If your Next.js app uses `output: 'export'` — no server-side rendering, no API routes at runtime, no image optimization server, no middleware — Pages is sufficient, free, and already wired to your repo. Its one real limit for this job: **it hosts exactly one custom domain and can't redirect the others.**

**Vercel** is built by the Next.js team and runs every Next.js feature natively — server-side rendering, Incremental Static Regeneration, API route handlers, middleware, `next/image` optimization, per-pull-request preview deployments — **and it hosts multiple domains with native 301 redirects.**

Here's the honest decision:

> 💡 **Choose GitHub Pages** if your app is static (it probably is, if you're reading a "static Next.js" guide) and you're fine handling the extra-domain redirects at your registrar or via [Cloudflare](https://www.cloudflare.com/) (free). **Choose Vercel** if you want server features you're not using yet, per-PR previews, _or_ you want all your domains + redirects managed in one dashboard.

For a fully static app, the multi-domain redirect need is the single most common reason people reach for Vercel at launch — and it's worth knowing that Cloudflare in front of Pages solves the same problem for free. Don't migrate hosts for a feature you can get with a redirect rule. (There's a fuller [Pages-vs-Vercel breakdown](/blog/client-email-not-a-spec) elsewhere; this post covers both paths below.)

The steps that follow have a **Pages path** and a **Vercel path** where they differ.

## 🌐 Step 3 — DNS + drop the basePath

### The basePath trap (read this first)

A Next.js app deployed to `github.io/YourApp` runs under a **basePath** of `/YourApp` — every asset and link is prefixed with it. A custom apex domain serves from the **root** (`/`), so the basePath must be **dropped**. If you forget, every asset 404s at the new domain.

Well-built templates automate this. In ScriptHammer-based apps, the basePath is auto-detected: it's set to `/RepoName` **only when no `public/CNAME` file exists**. So adding the CNAME file is the single switch that both configures the domain _and_ drops the basePath:

```js
// scripts/detect-project.js — the load-bearing line
const basePath =
  isGitHubActions && isGitHub && !cnameExists ? `/${projectName}` : '';
```

Add `public/CNAME` with one line — your canonical domain:

```text
heldpaws.com
```

Commit it. On the next build, `basePath` becomes `''` and the app serves from root.

### DNS records — Pages path

At your DNS provider for the canonical domain, add GitHub Pages' apex records:

```text
A     @   185.199.108.153
A     @   185.199.109.153
A     @   185.199.110.153
A     @   185.199.111.153
AAAA  @   2606:50c0:8000::153
AAAA  @   2606:50c0:8001::153
AAAA  @   2606:50c0:8002::153
AAAA  @   2606:50c0:8003::153
CNAME www tortoisewolfe.github.io.
```

Then **GitHub → Settings → Pages**: set the custom domain, wait for the DNS check to go green, and enable **Enforce HTTPS**.

**The other domains → 301:** at your registrar (or Cloudflare), forward `heldpaws.org`, `raisedpaws.com`, `raisedpaws.org` → `https://heldpaws.com`. Registrar forwarding is simplest; Cloudflare gives you clean redirects with HTTPS on every domain.

### DNS records — Vercel path

Import the repo in the Vercel dashboard, then **Project → Settings → Domains**: add all four domains. Vercel tells you the exact records — typically an `A` record to `76.76.21.21` for the apex and a `CNAME` to `cname.vercel-dns.com` for `www`. In the same panel, set the three non-canonical domains to **redirect to** `heldpaws.com` (Vercel does the 301 natively). Vercel provisions HTTPS on all four automatically.

> ✅ **Verify either path:** `dig heldpaws.com +short` returns your host's IPs; `curl -sI https://heldpaws.com/` is a 200 and asset URLs have **no** `/RepoName` prefix; `curl -sI https://heldpaws.org/` returns a `301` to `https://heldpaws.com/`.

## 🔐 Step 4 — Update auth + API redirect URLs (do not skip)

This is the step that silently breaks sign-up on launch day. If your app uses [Supabase](https://supabase.com/) auth, the redirect URLs it emits — for email confirmation, OAuth (Open Authorization), and password reset — are built from your site's origin. Change the origin, and Supabase's **exact-match allow-list** no longer matches, so confirmation links bounce.

**In the Supabase dashboard → Authentication → URL Configuration:**

- **Site URL:** `https://heldpaws.com`
- **Redirect URLs** (add — trailing slashes matter; the allow-list is exact-match and static hosts 301 the slash-less form):
  - `https://heldpaws.com/auth/callback/`
  - `https://heldpaws.com/reset-password/`

Keep the old `github.io` entries until you've verified the cutover, then remove them.

**Server-side env (if you use Edge Functions):** anything server-side — CORS (Cross-Origin Resource Sharing) allow-lists, payment provider return URLs — reads a site-URL env var independently of the browser. Update it too:

```bash
# Supabase Edge Function secret
NEXT_PUBLIC_SITE_URL=https://heldpaws.com
```

**Build-time env (GitHub repo variables or Vercel env):** set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEPLOY_URL`, and `NEXT_PUBLIC_BASE_URL` (the last drives your blog's canonical + Open Graph tags) to the new domain, then redeploy so they bake into the static build.

> ⚠️ **Verify all four flows before you announce:** sign up with a fresh email → the confirmation link lands on `heldpaws.com/auth/callback/`; OAuth round-trips back to the domain; password reset lands on `/reset-password/`; a test-mode payment returns to the domain (not the old URL).

## 📱 Step 5 — Fix the PWA manifest scope

A PWA's `manifest.json` declares `start_url` and `scope`. On `github.io/YourApp` those need the `/YourApp/` prefix; at an apex domain they should be `/`. If your manifest hardcodes `/` it was _wrong_ under the basePath and becomes _right_ at the apex — so going live fixes it, but confirm rather than assume:

```json
{
  "start_url": "/",
  "scope": "/"
}
```

Verify: `curl -s https://heldpaws.com/manifest.json` shows `scope` and `start_url` of `/`, icons resolve (200), and a Lighthouse PWA audit reports the app installable. Install it from the new domain and launch it — it should open to the app, not a 404.

## 🔧 The invariant that just inverted

One last thing that saves a future headache. If your template auto-detects basePath from the presence of `public/CNAME` (as above), then **your project's own documentation probably says "`public/CNAME` must NOT exist."** That rule was correct _while you were on the project URL_. The moment you go live, it inverts: **`public/CNAME` must now exist and must survive future merges** — or a routine upstream sync could delete it and silently knock you back to the project URL.

Update that note in your `CLAUDE.md` / README as part of go-live, so nobody (human or agent) "cleans up" the CNAME six months from now.

## 🎯 Launch checklist

```text
[ ] Canonical domain chosen; others set to 301-redirect to it
[ ] Host chosen (Pages: static + registrar/Cloudflare redirects | Vercel: all-in-one)
[ ] public/CNAME added → basePath drops to ''
[ ] DNS records live; dig resolves; HTTPS enforced
[ ] Non-canonical domains 301 → canonical
[ ] Supabase Site URL + redirect allow-list updated (trailing slashes!)
[ ] Server + build env vars set to the new domain; redeployed
[ ] All 4 auth/payment flows verified end-to-end on the new domain
[ ] PWA manifest scope = /, app installs from the new domain
[ ] The "CNAME must not exist" note inverted in project docs
```

Go in order, verify each step before the next, and the launch is boring — which is exactly what you want a launch to be. The single highest-risk item is Step 4: change the domain, forget the Supabase allow-list, and the app _looks_ live while every new sign-up quietly fails. Test it with a real fresh email before you tell anyone the doors are open.
