---
title: 'Handing an Agent the Keys: What I Let AI Touch, and What It Cost Me'
author: TortoiseWolfe
date: 2026-07-05
updatedAt: 2026-09-07
slug: cursor-github-identity
tags:
  - ai-agents
  - tokens
  - security
  - automation
  - workflow
  - github
categories:
  - security
  - workflow
excerpt: An agent with credentials can file your App Store paperwork, migrate your database and fix your booking system. It can also store a setting that does nothing, empty a table nobody may read, and lose access mid-task. Here is every key I hand over, what each one buys, and the failures that taught me the difference.
featuredImage: /blog-images/cursor-github-identity/featured-og.svg
featuredImageAlt: Handing an Agent the Keys - what an AI agent is given access to, and the failure modes that scoping mistakes produce
ogImage: /blog-images/cursor-github-identity/featured-og.png
ogTitle: Handing an Agent the Keys - What I Let AI Touch, and What It Cost Me
ogDescription: The full inventory of credentials I give AI agents, what each one buys, and six real failure modes - including a token that authenticated perfectly while doing nothing at all.
twitterCard: summary_large_image
---

# 🔑 Handing an Agent the Keys: What I Let AI Touch, and What It Cost Me

A collaborator joins your project. They work in [Cursor](https://cursor.com/), the Artificial Intelligence (AI) code editor, and they want its agent to do the mechanical parts of collaboration — open an issue, push a branch, file a pull request. Reasonable. So they message you: _"What token should I use?"_

That question has a good answer, and this post used to be just that answer. But the question does not stay put. It comes back at the database, then at the payment provider, then at the App Store, then at the scheduling system — and by the tenth time you are no longer answering a question, you are running a practice.

This is the expanded version, written after a year of that practice. It covers every key I actually hand over, what each one buys in real work, and six failures that taught me the difference between an agent that has access and an agent that has _useful_ access. Some of those failures are embarrassing. They are the most valuable part.

## 🤔 The Problem: An AI Agent Needs Hands, but Whose?

Cursor's agent can run shell commands and call the GitHub Application Programming Interface (API) on your behalf — usually through the [GitHub Command Line Interface (CLI)](https://cli.github.com), the `gh` tool. To do that, it needs credentials. Those credentials decide **who the service thinks is acting** every time the agent opens an issue or pushes a commit.

There are really only two ways to give an agent those hands:

1. **Share an existing token.** Someone pastes their Personal Access Token (PAT) to the collaborator, who drops it into Cursor. Fast. Also wrong.
2. **Let the collaborator authenticate as themselves.** They connect their own account, and everything the agent does is stamped with _their_ identity.

The whole argument is for option 2. But to see _why_ option 1 is a trap, you have to internalize one idea that trips up even experienced developers.

## 🔒 A Token Is an Identity, Not a Password

Here is the mental model that makes everything else click:

> ⚠️ **The core idea**: A token does not grant access to a _repository_. It grants access **as a person**. Whoever created the token, that is who the service believes is acting — no matter whose resources the token can reach.

Read that twice, because it inverts the way most people think about tokens. We picture a token as a key to a _door_ (the repository). It is really a key to an _identity_ (the account). The doors it opens are just a consequence of who that identity is.

This became concrete while building [RescueDogs](https://github.com/TortoiseWolfe/RescueDogs), a pet-adoption tracker forked from ScriptHammer. A collaborator (GitHub handle `schlajo`) needed Cursor to open issues and pull requests **in his name**, on a repository **we** own. His token had two properties that sound contradictory until you hold the model in your head:

- **Resource owner**: `TortoiseWolfe` — the account that _owns the repository_. Fine-grained tokens are scoped under the owner of the resources they touch.
- **Authenticated identity**: `schlajo` — the account that _created the token_. Every issue, commit and pull request it produces is attributed to `schlajo`.

The token reaches into a repo owned by one person while acting as a completely different person. That is not a loophole — it is exactly what you want. The collaborator operates inside your repository, and the history correctly records that _they_ did the work.

Take the lazy path instead, and three failures cascade. **Attribution collapses**, because every action shows up under your name and `git blame` starts lying. **Two-Factor Authentication (2FA) is bypassed**, because a token skips it by design — so a copy of your token is a 2FA-exempt copy of you. And **revocation becomes all-or-nothing**, because tokens are not per-person: cutting off one collaborator also breaks your own automation.

> 💡 **The rule**: Never send a token, and never accept one. Credentials are personal. The maintainer never hands one over; the collaborator generates their own.

That rule is where this post used to end. Everything below is what happens when you apply it to more than GitHub.

## 🗄️ The Access Inventory: What I Actually Hand Over

Here is the honest list. Not "what an agent could theoretically use" — what mine holds today, and the reasoning for each.

| Service                     | What the agent may do                                                    | What it must never do                                                      |
| --------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **GitHub**                  | Open issues and pull requests, push branches, read Actions results       | Change repository settings, read Actions secrets, touch other repositories |
| **Supabase (management)**   | Apply schema migrations, read grants and policies to verify them         | Delete projects, rotate keys, change billing                               |
| **Supabase (service role)** | Seed and clean test fixtures, run verification probes                    | Ever appear in client-side code or a committed file                        |
| **App Store Connect**       | Register a bundle identifier, set listing metadata, read back the app id | Submit for review — that stays a human decision                            |
| **Calendly**                | Read and update event types, attach conferencing                         | Delete invitee data, touch webhooks                                        |
| **Cloudflare**              | Apply cache and transform rules that live in version control             | Change Domain Name System (DNS) records or zone ownership                  |
| **Stripe and PayPal**       | Read payment and subscription state to reconcile it                      | Move money, or refund anything                                             |
| **Email and captcha**       | Send transactional mail, verify captcha tokens                           | Read anyone's inbox                                                        |
| **Expo build service**      | Build and submit binaries                                                | Publish an over-the-air update unreviewed                                  |

Two patterns hold across every row.

**The right-hand column is the real design.** It is easy to list what an agent should do; the scoping decision lives in what you deliberately withhold. When I granted the Calendly token, the task needed exactly two permissions — read event types, write event types. The interface offered a dozen, including one called `data_compliance:write`, described plainly as _"delete invitee or event data."_ Nothing in the task wanted that. Granting it anyway would have been free, invisible, and completely unnecessary.

**Read access is not the safe default people assume.** A management credential that can only read is still a credential that can enumerate your entire schema, your users' email addresses and your billing state. Least privilege applies to reads.

For GitHub specifically, the permission set an agent needs to do collaboration chores is small: **Issues** read and write, **Contents** read and write, **Pull requests** read and write, and **Metadata** read, which GitHub adds automatically. Notice what is absent — no Administration, so it cannot change settings or add collaborators; no Secrets, so it cannot read your Continuous Integration credentials; and no access to any other repository. Scope the token to the single repo, set those four, and leave everything else at "No access."

> ✅ **Best practice**: Give every token an expiration — 90 days is a sane default. A token that expires on its own is one you can never forget to clean up.

## 🚀 What This Actually Buys

Access is a cost. Here is the return, from real work rather than a feature list.

**Paperwork that is pure mechanism.** Setting an app up in App Store Connect is roughly twenty fields across two websites. Four of them are permanent. One silently swallows every TestFlight build if you miss it — no error, no email, the build simply never appears. An agent with a signing key registers the bundle identifier, patches the listing name, reads back the app id and wires the configuration files, then stops at the one dialog Apple reserves for a human. It exits with a distinct code meaning _"I did everything permitted; now a person must open a browser."_ That is a genuinely new category of automation: not "do the task", but "do all of the task that is legally doable, and be precise about the boundary."

**Schema changes that are verified, not just applied.** With a database management credential, an agent can apply a migration and then _prove_ it worked — running the destructive operation as an unprivileged role inside a transaction that cannot commit, and reporting what was refused. That is a check no human runs by hand, because it is tedious and requires care to do safely. An agent will run it every single time.

**Whole systems repaired end to end.** In one session an agent traced a booking system that had been quietly broken for seven months, found the cause was a missing conferencing setting rather than any code, fixed it through the scheduling provider's API, and verified the fix on the public booking page a customer would actually see.

That last one is the shape of the business case. The work was not hard. It was _fiddly, cross-system, and nobody had time to trace it._ Which is exactly the work that never gets done, and exactly what an agent with credentials is good at.

## 🐛 What It Costs When the Scoping Is Wrong

Now the other side. Every failure below is mine, most from a single session, and each one taught a distinct lesson.

**I pasted an over-scoped token into a chat transcript.** I had asked for two permissions and been given all twelve, including the one that deletes customer data. Then, rather than putting it in an ignored environment file, I pasted it straight into the conversation — where it is now permanently logged. Two ordinary mistakes, thirty seconds apart. The lesson is not "be careful"; it is that the interface offered "select all" and the safe path required deliberate effort, so build the deliberate effort into your process instead of your willpower.

**A credential stored a setting that did nothing.** I set a video-conferencing location on a scheduling event. The API returned `200`. A fresh read returned exactly what I had written. Both were true, and both were useless — the booking page still showed no location, because the underlying integration was not connected. The service accepted an unusable configuration silently, twice.

> ⚠️ **The lesson that generalizes**: An API's acknowledgement is not evidence of an outcome. A write that reads back correctly has proven the write, not the effect. Verify at the surface a user actually sees.

**A stale token silently shadowed a working one.** An old credential sat in an environment file. The `gh` CLI prefers an environment variable over its own stored login, so every shell that loaded that file lost GitHub authentication and reported a bare `401 Bad credentials` — while `gh auth status` in a clean shell insisted everything was fine. Loading that file is the documented way to do database work in this project, so the two collided constantly.

**A token quietly lost access mid-task.** A management credential that had applied four migrations successfully began returning `403` for the one project it administered. It still authenticated — listing projects returned `200`. The project had simply moved to an organization the account could no longer reach. Nothing local had changed; the environment file was three weeks old.

**An agent action had an invisible side effect.** Creating a new scheduling event type silently deactivated a different one, because the plan permits exactly one active event at a time. The one deactivated was the live booking link on the site. No warning, no error — just a working system quietly switched off by a successful operation.

**And sometimes the platform simply says no.** An attempt to verify a booking end to end was refused as bot traffic: _"This booking cannot be completed. For security reasons, we are not able to finalize this booking from your current session."_ That is the honest boundary of automating everything, and it is worth knowing where it sits.

**And then the one that reframes all the others.** While researching this post, an agent audited its own environment and found a directory holding thousands of snapshots of files it had edited. When one of those files was a `.env`, the snapshot preserved its contents. Sitting there were **live** values: a production payment key, two database service-role keys that bypass row-level security entirely, database passwords, management tokens, and half a dozen third-party credentials — across a dozen projects.

Nothing had been breached. No attacker was involved. The directory belonged to the tool, sat outside every repository, and had therefore never been seen by the secret scanner — which only ever runs inside a repository. Every one of those keys had been rotated at some point, and every rotation had left the old copy exactly where it was, because **rotation replaces a credential; it does not delete the copies.**

The part that should worry you is why it went unnoticed for months. Every "did we leak anything?" sweep had been run with a recursive `grep`. On that machine `grep` is [ugrep](https://ugrep.com/), and a recursive search from a project root **silently skips exactly the files that hold secrets**. The check ran, found nothing, and printed a clean result. Proving it took one control:

```bash
# The value IS in the file:
grep -c SUPABASE_ACCESS_TOKEN .env      # -> 1

# The recursive sweep does not list that file at all:
grep -rl SUPABASE_ACCESS_TOKEN .        # -> .env absent from the output
```

> ⚠️ **The uncomfortable version**: the exposure and the blindness to it had the same root. A tool wrote secrets somewhere nothing looked, and the thing that would have looked was broken in a way that produced reassuring output. Neither half announced itself.

## 🎯 The Rules That Fall Out

Six failures, five rules.

**Scope to the task, not to the service.** The question is never "what does this tool do?" but "what does this job need?" Grant that, and nothing else. Where an interface offers a convenient superset, treat the convenience as the hazard.

**Verify at the surface that matters, not the one that answers fastest.** The `200` is not the outcome. The read-back is not the outcome. The customer-facing page is the outcome. This is the same instinct as checking `gh api user --jq .login` before trusting an identity — confirm who is really acting and what really happened, not what the system reports about itself.

**Expect silent success.** The most expensive failures here were not errors. They were operations that succeeded and accomplished nothing, or succeeded and broke something adjacent. Design your checks to catch a working call with a useless result.

**Make revocation a first-class step, not a cleanup task.** Every credential needs a documented answer to "how do I turn this off, and what breaks when I do?" — decided before it is issued, not during an incident.

**Assume access is temporary.** Tokens expire, organizations move, memberships change, and none of it announces itself. An automation that assumes stable access will fail in a way that looks like a bug in your code.

Here is the whole discipline as a checklist:

- ✅ Each human uses **their own** credentials — never a shared token
- ✅ Tokens are **fine-grained**, scoped to the narrowest resource that works
- ✅ Permissions match the **task**, with destructive scopes deliberately withheld
- ✅ Secrets live in **ignored files**, never in a transcript or a commit
- ✅ Every credential has an **expiration**
- ✅ Every change is **verified at the user-facing surface**
- ✅ Off-boarding is a **single per-person revocation**

## 🧪 Verify It's Really Them

Setup you do not verify is setup you do not have. Before trusting an agent with real work, confirm who the service thinks it is, that it can do the thing, and that the loop closes.

```bash
# 1. Who am I authenticated as? Must print the collaborator's handle.
gh auth status
gh api user --jq .login     # expect: schlajo

# 2. Do I have push access to the target repo (without changing anything)?
gh api repos/TortoiseWolfe/RescueDogs --jq '.permissions'
# expect an object containing: "push": true

# 3. Prove issue creation, then clean up after yourself.
gh issue create -R TortoiseWolfe/RescueDogs \
  --title "cursor auth smoke test (delete me)" \
  --body "verifying Cursor can open issues as schlajo"
gh issue close <the-number-it-printed> -R TortoiseWolfe/RescueDogs \
  --comment "smoke test passed, closing"
```

A few failure modes come up often enough to name. If `gh api user --jq .login` prints the **maintainer** rather than the collaborator, an old or shared credential has crept in — log out and back in, and never "just proceed", because every action would be misattributed. If `push` is `false`, the token lacks **Contents: Read and write** or was scoped to the wrong repository. If commits land as an anonymous avatar with no account behind them, the token is fine but the local `git config user.email` is not an address verified on that account. And if `gh` returns a **404 on a repository that clearly exists**, that is how fine-grained tokens hide resources they cannot see — the repo was not selected in the token's access list.

Catching these at the smoke-test stage costs seconds. Catching them after fifty misattributed commits costs an afternoon of history archaeology.

## 🔒 Revoke, Rotate, Expire

Credentials are not "set and forget."

- **Expire by default.** A 90-day expiration means nobody has to remember to clean up. Regenerating takes two minutes; an eternal credential drifting around costs much more.
- **Rotate on any suspicion.** Pasted in the wrong window, committed by accident, shown on a screen-share — revoke and mint a new one. Because it was fine-grained, the blast radius was already small and rotation is cheap.
- **Revoke cleanly when someone leaves.** This is the payoff for doing it right: off-boarding is a single revocation of _their_ credential, touching nobody else.

Manage or revoke GitHub fine-grained tokens at **[github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)**.

## 📌 Takeaways

1. **A token is an identity.** Sharing one erases attribution, bypasses 2FA and makes clean revocation impossible.
2. **Scope to the task.** The permissions you withhold are the design; the ones you grant are just the requirements.
3. **An acknowledgement is not an outcome.** Verify where a user would look, not where the API answers.
4. **Expect silent success and invisible side effects.** The costly failures are rarely errors.
5. **Access is temporary.** Build for the day the credential stops working, because it will.

The return on all of this is real: paperwork that fills itself, migrations that verify their own effects, and systems that get traced end to end because tracing them stopped being tedious. But the return only holds while the scoping does. An agent with the right keys is a genuinely new kind of colleague. An agent with all the keys is an incident with good intentions.

If you are handing off work to a collaborator's agent, the companion piece is **[Send It Back Without Taking It Over](/blog/reject-without-taking-over/)** — how to reject a pull request without erasing the author's name from it. For giving an agent read access to something as messy as a client's inbox, see **[Your Client's Email Is Not a Spec](/blog/client-email-not-a-spec/)**. And for what happens when a credential is merely _wrong_ rather than over-scoped, **[The Storefront That Could Not Take Money](/blog/storefront-that-cannot-take-money/)** is a postmortem on a test-mode payment key that reached production.
