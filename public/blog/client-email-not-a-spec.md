---
title: "Your Client's Email Is Not a Spec: Turning Mail Into Tickets"
author: TortoiseWolfe
date: 2026-07-07
slug: client-email-not-a-spec
tags:
  - mcp
  - github
  - freelancing
  - project-management
  - ai-agents
  - workflow
categories:
  - tutorials
  - workflow
excerpt: A client's email hides the real expectation inside chatty prose and un-transcribed screenshots. Here's how an MCP server that reads your mail and drafts GitHub tickets tightens the contract between what they asked for and what you ship.
featuredImage: /blog-images/client-email-not-a-spec/featured-og.svg
featuredImageAlt: Your Client's Email Is Not a Spec - an MCP server turning loose client mail into tightly-scoped GitHub tickets
ogImage: /blog-images/client-email-not-a-spec/featured-og.png
ogTitle: Your Client's Email Is Not a Spec - Turning Mail Into Tickets
ogDescription: An MCP server that reads client email and drafts GitHub issues, tightening the contract between what the client expects and what you deliver.
twitterCard: summary_large_image
---

# 📨 Your Client's Email Is Not a Spec: Turning Mail Into Tickets

A client emails you: _"A few hot issues with the new site..."_ Attached are three screenshots and one run-on paragraph. Somewhere in there is a broken feature, a request for something they never quite name, and an expectation about what "done" means that they assume is obvious and you have not actually agreed to.

That email is not a specification. It is a **loosely-encoded intention** — and the gap between what the client meant and what you build is where freelance projects quietly go wrong. Not through malice or incompetence, but through the slow drift between a chatty message and a shipped deliverable that each party remembers differently.

This post is about closing that gap with a small piece of automation: a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that reads your client mail and drafts a structured [GitHub](https://github.com/) issue from each message. The tool is almost beside the point. What matters is the discipline it enforces — turning a paragraph into a ticket forces every buried expectation to the surface, where both of you can see it and sign off on it. It **tightens the contract between expectation and deliverable**.

The examples below are drawn from real client correspondence, anonymized into composites — no real client, company, or project is identifiable. The pattern, though, is exactly as it happened.

## 🤔 What "the Contract" Actually Means

When a client sends you a request, two documents exist at once:

1. **The literal email** — the words they typed.
2. **The implied contract** — what they will believe was promised when they read your invoice.

These are almost never the same document. The email says "clean up the blog admin"; the implied contract is "I should be able to run my own site without calling you." The email says "where's that setting again?"; the implied contract is "the thing I shared on social media should show the current homepage, not the old one." The literal words are a fraction of the real ask, and the rest lives in the client's head as an assumption.

A ticket is where you make the implied contract **explicit and mutual**. A good ticket states the problem, names the deliverable, and defines "done" as something checkable — so the thing the client assumed and the thing you build are pinned to the same testable end-state. That is the entire game. Everything below is in service of getting there faster and more reliably.

## 🔨 The Machine: Mail In, Tickets Out

Here is the shape of the automation. An MCP server exposes tools that a Model like Claude can call. For this workflow you need two capabilities:

- **A mail reader** — search threads, fetch full message bodies. (A Gmail MCP server provides `search_threads` and `get_thread`.)
- **A ticket writer** — create GitHub issues. (The [GitHub Command Line Interface (CLI)](https://cli.github.com), `gh issue create`, is the simplest path; a GitHub MCP server works too.)

The loop is straightforward:

```text
1. Search mail for real client threads (not newsletters/automation).
2. Fetch the full thread — every reply, not just the latest.
3. Extract the structured ticket: problem, scope, acceptance criteria.
4. Anonymize / sanitize if the ticket will be public.
5. Draft the GitHub issue for human review before it's filed.
```

Two design decisions matter more than the plumbing:

> 💡 **Draft, don't auto-file.** The Model proposes a ticket; a human approves it before it lands in the tracker. Client intent is too easy to misread for a fully autonomous pipeline. The value is the _extraction_, not the automation of the final click.

> ⚠️ **Filter aggressively.** A real inbox is 90% noise — job alerts, calendar invites, newsletters, uptime pings. Search on real two-way threads from named client addresses, not broad keywords, or the Model drowns in `no-reply@` mail.

Concretely, the search side looks like this. A broad keyword query returns mostly garbage; a targeted one returns actual client conversations:

```text
❌ Noisy:  "project OR request OR feedback"
           → job alerts, newsletters, uptime pings

✅ Targeted:  from:client@example.com OR to:client@example.com
              → real two-way threads only
```

And the write side is a single command once the Model has drafted the ticket body:

```bash
gh issue create \
  --repo you/project \
  --title "Events calendar not loading + enable WYSIWYG editor" \
  --body-file /tmp/drafted-ticket.md \
  --label "client-request"
```

Everything between those two steps — read the thread, extract the structure, sanitize — is the Model's job, driven by a prompt that tells it exactly what a good ticket contains: a problem statement, the buried expectation, and acceptance criteria phrased as checkable outcomes.

The rest of this post is four real messages run through that loop. For each, you'll see the loose input and the structured ticket it becomes — and, more importantly, _which hidden expectation the ticket surfaced._

## 🐛 Story 1: The "Hot Issues" Bundle

**The email** (paraphrased): A single message titled roughly "a few hot issues with the new site." It bundled two bugs and a feature request into one paragraph — the events calendar was broken and wouldn't load; the client wanted a real rich-text editor so he wouldn't have to hand-write HyperText Markup Language (HTML) to update content; and he pointed at another site as "at least it has a real editor." Attached: three screenshots — a dialog that pops up on every edit, plus two error screens. **The actual error text existed only inside the images. None of it was transcribed into the email.**

That last detail is the killer. The diagnostic information — the thing you need to fix the bug — is trapped in a screenshot that will be buried in a mail thread within a week. Here's the ticket the loop drafts:

```text
TICKET: Events calendar not loading + enable WYSIWYG/in-place editor
        (content edits throw errors)

## Problem
The site owner (a non-technical author who maintains the site himself)
reports three blocking issues, all tied to one underlying expectation:
he should be able to update the site day-to-day without touching code.

1. Events calendar is broken — the calendar page does not load.
2. No usable content editor — editing requires raw HTML / a sidebar
   panel. He wants a rich-text (WYSIWYG) editor, ideally in-place.
3. Errors when editing — a dialog on every edit (screenshot 1) plus
   two more errors (screenshots 2, 3). Transcribe the exact text here.

## Acceptance Criteria
- [ ] Calendar page loads and displays events in production.
- [ ] Root cause documented (not just a cache clear).
- [ ] A WYSIWYG editor is enabled; formatting needs no raw HTML.
- [ ] In-place editing evaluated + enabled if feasible.
- [ ] The edit-time dialog and both errors no longer occur.
- [ ] The owner confirms he can revise and save without errors.

## Notes
- Transcribe the three screenshots — the raw email is not durable.
- Split the calendar fix (higher priority) from the editor work.
```

**What the ticket tightened:** The email fused a bug, a feature, and a complaint into "make editing better." The ticket splits them into three testable criteria; forces the screenshot error text into a durable, searchable record so the fix targets the _real_ error; converts the subjective "that other site is better" into a concrete deliverable (enable a named editor, evaluate in-place editing); and defines "done" as _the owner himself editing and saving without errors_. That last line pins the fuzzy expectation — "I should be able to maintain my own site" — to something you can both verify.

## 📝 Story 2: The Load-Bearing Aside

**The email** (paraphrased): A chatty "final issues & questions" punch-list against two sibling sites the developer had built. It opened with the usual list — turn on an announcements banner, add spam protection, fix the social share image, clean up the blog admin, edit the call-to-action block on blog posts, add subscribe and Really Simple Syndication (RSS) buttons. The developer replied item-by-item. Then, in the client's reply — amid the thank-yous and one-off answers, sitting right next to a question about hiding a banner — came the load-bearing sentence:

> _"Let's be sure to capture all of these as reusable components for future purposes, as well as replicating them on the sibling site."_

That one aside changes the entire scope. The punch-list, read literally, is "make these six fixes on site A." The aside says "build a portable, client-editable component library and deploy it to site B too." Those are wildly different deliverables, and the important one is hiding in a subordinate clause.

```text
TICKET: Extract all one-off fixes into reusable, client-editable
        components and replicate them on the sibling site

## Problem
The punch-list fixes (announcements banner, blog CTA block, share
image, subscribe/RSS, spam protection, blog-admin UX) were shipped as
site-specific one-offs. The blog CTA had no admin screen at all until
rebuilt. The client wants them captured once as reusable components
— portable to future sites, replicable on the sibling site without a
rebuild, and editable by the client with no code.

## Acceptance criteria
- [ ] Every item is a named, parameterized component/variable, not a
      hardcoded one-off.
- [ ] Each is editable through the admin with zero code changes.
- [ ] Banner + post CTA are hideable via unpublish (reversible).
- [ ] The same component set renders on the sibling site.
- [ ] Site-specific values (URLs, handles, images) are per-site vars.
- [ ] A short inventory doc lists where each lives + how to edit it.

## Notes / dependencies
- Sibling go-live is gated by separate infra items (a CNAME change,
  a legacy-content decision) — track separately; don't block on them.
- Bill the component work, the infra items, and the milestone
  invoicing as three separate tracks, each with its own owner.
```

**What the ticket tightened:** It converts a vague "let's be sure to" into a checkable definition of done — each fix must be a named, parameterized, client-editable component (not a bespoke block), replicated to the second site, with an inventory doc. That closes the gap between what the client will _assume_ was delivered (a shared, no-code-editable component library) and what a literal reading of the punch-list would deliver (a pile of site-A-only fixes). It also splits three tangled concerns — the component contract, the infrastructure go-live items, and the billing — into separate tracks with separate owners, instead of one ambiguous email where a blocking Domain Name System (DNS) dependency rides along next to a design tweak.

## 🌐 Story 3: The One-Line Question With Two Answers

**The email** (paraphrased): One line. Subject roughly "Where's the link-preview setting again?" The client had just shared his freshly relaunched site on social media, and the preview card — the [Open Graph (OG)](https://ogp.me/) card, the image and title that render when a link is shared — was showing the _first version_ of his homepage. He attached a screenshot of the stale card and asked where the setting lives. The trailing _"...again"_ is the tell: he's been walked through this before and wants a quick reminder.

Here is the trap. The obvious response is a one-sentence answer: "It's under site settings → metadata." That answer is correct **and it will not fix his problem**, because the social platform has _cached_ the old card and will keep serving it until the URL is re-scraped — no matter what you change in the Content Management System (CMS). The real job has two halves, and only one of them is the setting he asked about.

```text
TICKET: Social link-preview shows stale homepage — fix the OG
        metadata AND bust the cached social card

## Problem
When the homepage is shared on social, the preview card renders the
FIRST version of the homepage. This is stale Open Graph metadata being
served and/or cached by the platform.

## Root cause candidates
1. The CMS emits outdated og:image / og:title / og:description for the
   front page (global config or a per-page override points at old copy).
2. The platform cached the old card and will keep showing it until the
   URL is re-scraped — even after the HTML is fixed. Fixing only #1
   leaves the visible problem alive.

## Acceptance criteria
- [ ] Update og:image / og:title / og:description for the homepage.
- [ ] Verify served HTML: `curl -s <url> | grep 'og:'` shows new tags.
- [ ] Re-scrape the URL in the platform's sharing debugger; confirm
      the new card renders.
- [ ] Reply with the exact click-path PLUS the re-scrape step, so the
      "...again" is documented and self-serviceable next time.

## Notes
- Client is actively promoting the site — every share advertises the
  old homepage. Treat as time-sensitive.
```

**What the ticket tightened:** A vague "where's that setting?" invites a one-sentence reply that leaves the client's actual problem alive. The ticket forces both halves of the real job to the surface — correct the _source_ metadata **and** bust the _platform cache_ — with a verification step (`curl` the served tags, re-scrape, re-post) that proves the preview is fixed rather than assumed. It also converts a one-off favor into a documented click-path, so the next _"...again"_ is answered by a link instead of another round-trip. "Done" moves from "name a setting" to "the shared card shows the current homepage, verified."

## ✅ Story 4: What "Already Tight" Looks Like

The first three stories are the _before_ — loose emails hiding their real ask. This one is the _after_: input that already arrives as a near-perfect ticket, because the sender did the extraction themselves.

**The input** (paraphrased): A collaborator filed a bug against the account settings screen — labels sit flush against or overlapping their input boxes horizontally, with no readable gap. They named the exact affected fields (display name, bio, two password fields), stressed it was _horizontal_ spacing (not vertical), pointed at the exact route and component file, and asked for it to "match the label-spacing pattern we already merged on the sign-in and sign-up forms."

```text
TICKET: Account settings: horizontal gap between labels and inputs
        (mirror the auth-form label-row pattern)

## Problem
On account settings, field labels sit flush against / overlap their
inputs horizontally — no gap between label text and box border.
Affected: Display Name, Bio, New Password, Confirm Password.

## Expected
A consistent horizontal gap, matching the sign-in / sign-up forms.
Mobile: stack label above input; at sm+ use a shared label-column
width so all inputs align.

## Suggested approach — mirror the sign-in / sign-up row
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center
       sm:gap-x-6">
    <label className="sm:w-36 sm:shrink-0 sm:text-right" ...>

## Acceptance criteria
- [ ] Visible gap on all four fields; no border overlap.
- [ ] Portrait mobile: labels stack; inputs full width, not crushed.
- [ ] Tests updated; type-check + lint green.
```

**Why this one matters:** notice how little translation the loop had to do. The collaborator delivered the problem, the exact surface, the canonical solution (an existing pattern to mirror), _and_ checkable acceptance criteria. There is almost no gap between what they asked for and what a developer would ship — because they closed it themselves before sending. This is the target state. The MCP loop exists to move Stories 1 through 3 toward looking like Story 4, automatically.

## 🔒 A Word on Anonymization

If your tickets — or a blog post like this one — will ever be public, the extraction step needs a **sanitization gate**. Client email is full of identifying detail: names, company names, domains, dollar amounts, dates, URLs. Before any extracted ticket leaves the private tracker, strip every one of those and replace them with generic stand-ins, ideally blending several real messages into a composite so no single thread is reconstructable.

> ⚠️ **Make it a hard gate, not a nice-to-have.** The extraction Model should be explicitly instructed to list every identifier it found and confirm each was removed — and, for anything public, a second pass should adversarially check whether a reader could still identify the client. The four stories above went through exactly that gate; the composites keep the _texture_ of real client work while pointing at no real client.

Even for private tickets, sanitization has value: it keeps client secrets (staging URLs, contact details, internal deadlines) out of a tracker that more people can read than you'd think.

## 🎯 Takeaways

The MCP server is a convenience. The discipline is the point, and you can practice it by hand today:

1. **Treat every client email as a loosely-encoded intention, not a spec.** The real ask is usually larger than the words, and the important part is often a subordinate clause.
2. **Write the ticket before you write the code.** The act of stating problem, deliverable, and checkable "done" is what surfaces the buried expectation.
3. **Define "done" as something you can verify** — "the owner edits and saves without errors," "the shared card shows the current homepage" — not "make it better."
4. **Separate tangled concerns** into their own tickets with their own owners; don't let a blocking dependency ride along next to a design tweak.
5. **If it goes public, anonymize behind a hard gate**, and prefer composites over single real threads.

Automate that loop with an MCP server and you draft tickets in seconds instead of minutes. But whether you automate it or not, the win is the same: the email the client _sent_ and the work you _ship_ get pinned to the same testable contract — and the quiet drift that sinks freelance projects has nowhere left to hide.
