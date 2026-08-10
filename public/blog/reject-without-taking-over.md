---
title: "Send It Back Without Taking It Over: Rejecting an Agent's PR"
author: TortoiseWolfe
date: 2026-07-07
slug: reject-without-taking-over
tags:
  - code-review
  - github
  - ai-agents
  - collaboration
  - authorship
  - workflow
categories:
  - workflow
  - tutorials
excerpt: When a collaborator's AI agent hands you a flawed pull request, the trustworthy way to block it is a request-changes review with a paste-ready fix — never a fixup commit on their branch. That one convenience commit erases the authorship your whole identity discipline exists to protect.
featuredImage: /blog-images/reject-without-taking-over/featured-og.svg
featuredImageAlt: Send It Back Without Taking It Over - rejecting an AI agent's pull request while preserving its authorship
ogImage: /blog-images/reject-without-taking-over/featured-og.png
ogTitle: Send It Back Without Taking It Over - Rejecting an Agent's PR
ogDescription: The trustworthy way to block a collaborator's AI-generated pull request is a request-changes review with a paste-ready fix and a tracking issue, never a fixup commit that steals their authorship.
twitterCard: summary_large_image
---

# 🔀 Send It Back Without Taking It Over: Rejecting an Agent's PR

_Third in a series on the assembly line for AI-written code. [Post one](/blog/cursor-github-identity) got the agent's identity right; [post two](/blog/client-email-not-a-spec) turned a client's email into a scoped ticket. Now the agent has implemented that ticket and opened a pull request. This is the merge gate._

The pull request lands. Your collaborator's [Cursor](https://cursor.com/) agent picked up the scoped ticket from the last post — fix the auth-form label spacing — implemented it, and opened a Pull Request (PR). You skim the diff. It's mostly right. There's one rough edge: the layout still crowds on mobile. And here is the moment the whole series turns on, because the tempting move is also the wrong one.

The tempting move: pull the branch, fix the rough edge yourself, push, merge. Five minutes, done. **Do not do this.** That one convenience commit quietly undoes the single most important thing the first post in this series worked to establish — and it does it so smoothly you won't even notice the damage.

## 🔑 The One-Sentence Inversion

Here is the whole post in a sentence:

> ⚠️ **A fixup commit on their branch erases exactly the authorship the identity post fought to establish.**

Trace it. [Post one](/blog/cursor-github-identity) was an entire argument for making sure the agent acts as _the collaborator_ — their own token, their name on every commit, so the history tells the truth about who did the work. Then a flawed PR arrives, you `git commit` a fix onto their branch, and the record now shows _you_ touching their work. You verified who acted, and then — one commit later — you overwrote the record of who acted. Those are the same mistake, a single convenience apart.

Getting attribution right at authentication time and then destroying it at merge time is not a smaller sin than never getting it right at all. It's arguably worse, because you did the hard part and threw it away for five saved minutes. The merge gate has to _preserve the chain of custody_, not break it.

### Why the fixup feels harmless

The reason this shortcut is dangerous is that it feels _considerate_. You're not stealing credit — you're helping. You saw a small flaw, you fixed it, you saved your collaborator a round trip. Where's the harm?

The harm is in what the record says afterward, and records outlive intentions. Walk the concrete consequences:

- **`git blame` now lies.** Six months from now, someone runs `git blame` on that file to understand why a line is the way it is. It points at _you_. But you didn't write it, don't remember the context, and can't answer the question. The one person who could — the actual author — isn't even in the frame.
- **The contributor graph lies.** Your collaborator's commit count and contribution history now under-represent what they actually did. On a portfolio, an open-source résumé, or an internal performance record, that's not cosmetic — it's their work, uncredited.
- **The review trail evaporates.** When the fix arrives as _their_ commit responding to _your_ review, the history shows a clean request → response → merge. When it arrives as your fixup, that dialogue is gone; the "why" behind the change is a commit message you wrote about code you didn't originate.

None of that is visible in the moment. The diff looks the same either way; the tests pass either way; the feature ships either way. The damage is entirely in the metadata, which is exactly why it's easy to do and hard to notice. A discipline that only defends against _visible_ harm won't defend against this one.

So the rule for the rest of this post: **you never commit to a collaborator's branch to "just fix" their PR.** You reject it back to them, with everything they need to fix it themselves. Let's look at how to reject well — because a good rejection does far more than protect a byline.

## 🔍 Verify by Exercising, Not by Reading

Before you can send a PR back, you have to actually find what's wrong with it — and the flaw that matters is rarely the one Continuous Integration (CI) catches.

The auth-form PR passed all 17 CI checks. Green across the board. But the ticket was about _mobile_ layout, and the review didn't stop at the green checkmarks — it drove the change on a real device viewport. Measured at 320, 360, and 390 Cascading Style Sheets (CSS) pixels on the running app, the "fixed" layout crushed the email and password inputs to roughly **120px wide — about 11 visible characters.** A normal email address overflowed and hid more than half its own value.

CI missed this completely, and the reason is instructive:

> 💡 The End-to-End (E2E) width check only asserted input _height_, and only visited the `/` route — never the auth pages. A green suite proved the touch targets were 44px tall. It said nothing about whether you could read what you typed.

This is the core verification move of the whole series: **you confirm a claim by exercising it, not by reading the diff or trusting the badge.** The PR _said_ "responsive label spacing." The green suite _said_ "passing." Only driving the actual page at a phone width said "the input is unusably narrow." If the review had stopped at the diff, that regression ships.

## 🧪 A Good Review Has Dimensions

"Reject" isn't a single verdict. A useful review separates concerns along at least three axes, so the author knows _which_ problems block the merge and which are asides.

- **Correctness** — does each change do what it claims? The same PR carried a Husky pre-push hook fix. The review didn't just wave it through: it validated the diagnosis. The hook was dying with a SIGPIPE (exit 141) because `docker compose exec` closed the hook's standard input while `git` was still writing the ref list to it — a real race, correctly fixed by draining stdin first. Confirmed, not assumed.
- **Adversarial skepticism** — challenge the author's own explanation. The PR claimed a `z-index` change was part of the dropdown fix. The review pushed back: the header already established a stacking context, so that `z-index` change was a visual no-op — it _wasn't_ what fixed the dropdowns (the text-color change was). Accepting the author's causal story uncritically would have baked a wrong mental model into the codebase.
- **Completeness** — what did the change _miss_? The PR fixed the light-theme text color on several dropdowns but skipped one — a `FontSizeControl` dropdown sitting right beside the others, left invisible. The sibling fix was incomplete, and only a completeness pass catches that.

Then tier the findings so the merge gate is unambiguous:

```text
🔴 Blocking   — must fix before merge (the mobile input crush)
🟡 Fold-in    — fix while you're here (the missed dropdown)
🟢 FYI        — noted, non-blocking (the z-index no-op)
```

The author should never have to guess what actually gates the merge. One emoji per finding does that work.

### The review body, as a template

Here's the skeleton the actual review followed — worth stealing, because the ordering does real work:

```text
Thanks — the Husky fix and the dropdown fix are both solid. One
blocking item in the auth layout before merge, so I'm sending it back.

## 🔴 Blocking: horizontal label rows crush inputs on mobile
[measured evidence: 288px card, 120px inputs at 360px viewport]
[the fix, with byte-exact targets]

## 🟡 Worth folding in (not blocking on their own)
- FontSizeControl dropdown missed by the same text-color fix
- label-column widths diverge between the two forms

## 🟢 Minor / FYI
- z-[1] → z-50 is a visual no-op (header owns the stacking context)

## ✅ The Husky fix is correct
[affirm what's right, with the SIGPIPE diagnosis confirmed]
```

Two deliberate choices. First, it **opens and closes with what's right** — the SIGPIPE fix is real and good, and saying so plainly means the one blocking item reads as a targeted correction, not a referendum on the whole PR. An agent-authored PR is still someone's work; a review that's all red teaches nothing except discouragement. Second, the **blocking item comes first and alone under 🔴**, so there's zero ambiguity about what stands between here and merge. Everything under 🟡 and 🟢 is explicitly labeled as not gating. The author can act on the one thing that matters and treat the rest as backlog.

## 📮 The Reject Mechanic

Now the part where authorship lives or dies. You have findings; you need to return them _without_ touching their branch. Three moves:

**1. Request changes — don't approve, don't fixup.** GitHub has a first-class verb for exactly this:

```bash
gh pr review 13 --request-changes --body-file review.md
```

This blocks the merge and hands the PR back to the author. It does not put a single commit of yours on their branch.

**2. Include a paste-ready fix prompt.** The author implements in Cursor, so the review carries a fenced block they can paste straight into the agent — with byte-exact find/replace targets pulled verbatim from the branch, not paraphrased (agents match on whitespace):

```text
Fix the mobile-responsive auth-form layout. Context: issue #15, PR #13.
Make the label rows stack on mobile and go horizontal at sm+.

=== src/components/auth/SignUpForm/SignUpForm.tsx ===
Replace:
  <div className="flex flex-row items-center gap-x-6">
with:
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center
       sm:gap-x-6">

Then verify: docker compose exec scripthammer pnpm run type-check && lint
```

Pull those targets with `git show origin/<branch>:<path>` so they match the author's tree down to the whitespace.

**3. Open a tracking issue.** The review comment can scroll away; a branch can be force-pushed. A tracking issue (#15, alongside the review) gives the fix a durable target that survives both. The blocking finding now has a home that isn't tied to the branch's mutable state.

Notice what's absent from all three moves: `git commit`, `git push`, anything that writes to their branch. The fix travels back as _instructions_, and the author's agent does the writing.

### "But GitHub suggestions are one click" — the decision, honestly

There's a middle option worth naming, because it's tempting and it's not always wrong: GitHub's **suggested changes**, the little `suggestion` blocks in a review that the author can accept with one button. Where do those fall?

They're better than a fixup commit and worse than a paste-ready prompt, and the trade-off is specific:

| Approach                                 | Author's name on it?     | Author's agent stays in the loop?                 | Good for                       |
| ---------------------------------------- | ------------------------ | ------------------------------------------------- | ------------------------------ |
| **Fixup commit** on their branch         | ❌ No — it's your commit | ❌ No                                             | Never, for a collaborator's PR |
| **GitHub suggestion** (one-click accept) | ✅ Yes — commits as them | ⚠️ Bypasses their local tooling                   | A truly trivial one-liner      |
| **Request-changes + paste-ready prompt** | ✅ Yes                   | ✅ Yes — they run it through Cursor + local hooks | Anything non-trivial           |

A one-click suggestion _does_ preserve authorship — accepting it commits as the author, which is the whole point. So for a genuine typo, use it. But it has a subtle cost: it lands the change straight onto the branch _without going through the author's local pipeline_ — their pre-commit hooks, their type-check, their agent's understanding of the change. For the auth-form fix, which touched responsive breakpoints across multiple files and needed verification at phone widths, a one-click accept would have skipped exactly the local verification that should run. The paste-ready prompt keeps the author's whole toolchain in the loop, which is why it's the default for anything with moving parts.

The honest rule: **suggestions for trivia, prompts for everything else, fixups for nothing.**

## ✅ The Loop Closes Honestly

Here's the payoff, and it's the whole reason for the discipline. The author's agent took the request-changes review, applied the fix, and pushed — as _their own commit_:

```text
Address PR #13 review: auth forms use flex-col on mobile and
horizontal label rows at sm+ with a shared w-36 column;
FontSizeControl gets text-base-content
```

That commit is authored by the collaborator. The re-review then approved, and the PR merged — the merge commit authored by them too. Walk the whole arc: the agent authenticated as the collaborator (post one), turned a scoped ticket into a diff (post two), got rejected at the gate, fixed it, and merged — and at **every single step the history correctly records who did the work.** The chain of custody never broke, because no convenience commit ever severed it.

That is what "reject without taking over" buys you: a merge you trust _and_ a history that's true. A fixup commit would have bought the merge and quietly forfeited the history.

## 📌 Make It a House Rule, Not a Mood

A discipline you follow only when you remember to is not a discipline. So this one is written down. After that exact PR-and-issue flow, it was codified into the project's `CLAUDE.md` under "Collaboration Conventions":

> Reject-and-return uses GitHub's `gh pr review --request-changes` — never push fixup commits to a collaborator's branch, it erases their authorship.

Along with the paste-ready-prompt format (four-backtick fence, context line, byte-exact targets, in-container verify commands, reference links). The commit that added it says, in its own body, that it was "codified from the PR #13 / issue #15 review flow" — the rule is a direct fossil of the real event, not an abstract best practice someone imagined.

That matters because the tempting shortcut never stops being tempting. The next flawed PR will also look like it'd be faster to just fix yourself. Writing the rule into the repo means the gate holds even on the day you're tired and the fix is one line.

## 🎯 Takeaways

1. **Never commit to a collaborator's branch to fix their PR.** It erases the authorship your identity discipline established — the same mistake as never attributing correctly, one convenience commit later.
2. **Verify by exercising the change, not reading the diff.** A green suite told you the inputs were tall; only driving the page told you they were too narrow to use.
3. **Review in dimensions** — correctness, adversarial skepticism, completeness — and tier findings 🔴/🟡/🟢 so the author knows what gates the merge.
4. **Reject with `--request-changes` + a paste-ready fix + a tracking issue.** The fix travels as instructions; the author's agent does the writing.
5. **Write the rule into the repo.** A gate you keep only when you remember isn't a gate.

The agent can write the code. It can even fix its own PR. What it cannot do is decide, on your behalf, that a merge is trustworthy — that judgment is the human's, exercised at the gate. Reject-and-return is how you exercise it without erasing the very thing that made the work traceable in the first place.

_Next in the series: a green test suite that had been lying since the fork's first commit — and why fixing the root cause revealed nine real bugs it had been hiding._
