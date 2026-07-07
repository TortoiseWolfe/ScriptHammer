---
title: 'A Token Is an Identity: Let Cursor Commit as Themselves'
author: TortoiseWolfe
date: 2026-07-05
slug: cursor-github-identity
tags:
  - cursor
  - github
  - security
  - collaboration
  - ai-agents
  - tokens
categories:
  - security
  - tutorials
excerpt: When a teammate's AI agent touches your repo, whose name ends up on the commit? A guide to fine-grained tokens, least privilege, and letting Cursor act as the collaborator — not you.
featuredImage: /blog-images/cursor-github-identity/featured-og.svg
featuredImageAlt: A Token Is an Identity - letting a collaborator's AI agent commit as themselves with fine-grained GitHub tokens
ogImage: /blog-images/cursor-github-identity/featured-og.png
ogTitle: A Token Is an Identity - Let Cursor Commit as Themselves
ogDescription: Fine-grained GitHub tokens, least privilege, and how to let a collaborator's AI coding agent open issues and pull requests in their own name instead of yours.
twitterCard: summary_large_image
---

# 🔑 A Token Is an Identity: Let Cursor Commit as Themselves

A collaborator joins your project. They work in [Cursor](https://cursor.com/), the Artificial Intelligence (AI) code editor, and they want its agent to do the mechanical parts of collaboration for them — open an issue, push a branch, file a pull request. Reasonable. So they message you: _"What token should I use?"_

That single question hides a trap. The lazy answer — hand them a copy of yours — quietly breaks three things at once: attribution, security, and your ability to ever cleanly revoke access. The correct answer costs five minutes of setup and gets all three right.

This post is the long version of a conversation we actually had while building [RescueDogs](https://github.com/TortoiseWolfe/RescueDogs), a pet-adoption tracker forked from ScriptHammer. A collaborator (GitHub handle `schlajo`) needed Cursor to open issues and pull requests **in his name**, on a repository **we** own. Getting that right is a small masterclass in how GitHub authentication actually works — and it generalizes to any template fork where more than one human, and more than one agent, touch the same code.

## 🤔 The Problem: An AI Agent Needs Hands, but Whose?

Cursor's agent can run shell commands and call the GitHub Application Programming Interface (API) on your behalf — usually through the [GitHub Command Line Interface (CLI)](https://cli.github.com), the `gh` tool. To do that, it needs credentials. Those credentials decide **who GitHub thinks is acting** every time the agent opens an issue or pushes a commit.

There are really only two ways to give an agent those hands:

1. **Share an existing token.** Someone emails or pastes their Personal Access Token (PAT) to the collaborator, who drops it into Cursor. Fast. Also wrong, for reasons we'll unpack.
2. **Let the collaborator authenticate as themselves.** They connect their own GitHub account, and everything the agent does is stamped with _their_ identity.

The whole post is an argument for option 2, plus the exact steps to do it. But to see _why_ option 1 is a trap, you first have to internalize one idea that trips up even experienced developers.

## 🔒 A Token Is an Identity, Not a Password

Here is the mental model that makes everything else click:

> ⚠️ **The core idea**: A GitHub token does not grant access to a _repository_. It grants access **as a person**. Whoever created the token, that is who GitHub believes is acting — no matter whose repo the token can reach.

Read that twice, because it inverts the way most people think about tokens. We tend to picture a token as a key to a _door_ (the repository). It is really a key to an _identity_ (the account). The repositories it can open are just a consequence of who that identity is and what you scoped the token to.

This distinction became concrete on RescueDogs. Our collaborator's token had two properties that sound contradictory until you hold the model in your head:

- **Resource owner**: `TortoiseWolfe` — because that is the account that _owns the RescueDogs repository_. Fine-grained tokens are scoped under the owner of the resources they touch.
- **Authenticated identity**: `schlajo` — because that is the account that _created the token_. Every issue, commit, and pull request the token produces is attributed to `schlajo`.

So the token reaches into a repo owned by one person, while acting as a completely different person. That is not a bug or a loophole — it is exactly how GitHub is designed to work, and it is precisely what you want. The collaborator gets to operate inside your repository, but the history correctly records that _they_ did the work.

### 🗄️ Where Attribution Actually Lives

It helps to know that "who did this" is recorded in more than one place, and the token drives all of them:

- **Git author and committer.** Every commit carries an _author_ (who wrote the change) and a _committer_ (who applied it). Locally these come from your `git config user.name` and `user.email`. But when the agent pushes through the API, GitHub also links the commit to an _account_ by matching the commit email to a verified email on that account. Get the email wrong and the commit shows up as an anonymous gravatar with no account behind it — technically present in history, but disconnected from the person.
- **The actor on issues and pull requests.** Issues, comments, reviews, and pull-request actions have no "author email" to match — they are attributed purely to **whichever account the token authenticates as**. There is no ambiguity here: the token _is_ the byline.
- **The Verified badge.** Commits signed with a matching key show a green "Verified" badge. That is a separate layer, but it rests on the same foundation — an identity GitHub can tie to a real account.

The practical upshot: for the collaborator's work to be _fully_ theirs, two things must line up — the token authenticates as their account (drives issues, pull requests, and pushes), and their local `git config user.email` is an email verified on that same account (drives commit-to-account linking). Cursor's built-in sign-in handles both for you; the manual token path is where people occasionally get the email half wrong.

Now watch what happens if you take the lazy path and share a token instead.

### ❌ Why Sharing a Token Breaks Everything

Say you hand the collaborator a copy of _your_ token. Three failures cascade:

- **Attribution collapses.** Because the token authenticates as _you_, every issue the collaborator's agent opens, every commit it pushes, shows up under _your_ name. Your `git blame` lies. Your contributor graph lies. Six months later nobody can tell who actually wrote what.
- **Two-Factor Authentication (2FA) is bypassed.** You almost certainly protect your account with 2FA — a second factor beyond your password. A token skips it entirely; that is the point of tokens. So the moment your token leaves your machine, anyone holding it acts as you _without_ ever facing your second factor. You have effectively handed out a 2FA-exempt copy of yourself.
- **Revocation becomes all-or-nothing.** Tokens are not per-person. If you shared one token with a collaborator and later need to cut off _just them_, you can't — revoking that token also breaks your own automation that used it. Your only options are "trust them forever" or "break your own setup." Neither is acceptable.

Every one of those problems evaporates when the collaborator uses **their own** credentials. Their name lands on their work. Their 2FA protects their account. And if they ever leave the project, you revoke _their_ access without touching anyone else's.

> 💡 **The rule**: Never send a token, and never accept one. Credentials are personal. The maintainer never hands one over; the collaborator generates their own.

## 🔧 Fine-Grained Tokens and Least Privilege

If the collaborator is going to make their own credentials, the next question is: _how much power should those credentials carry?_ The answer is **as little as possible while still doing the job** — the principle of least privilege.

GitHub offers two kinds of Personal Access Token, and the difference matters:

- **Classic PATs** are coarse. A single classic token tends to grant broad scopes across **all** your repositories at once. If it leaks, the blast radius is your entire account.
- **[Fine-grained PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)** are surgical. You pick exactly which repository (or repositories) the token can touch, and exactly which permissions it has on them. If it leaks, the damage is bounded to that one repo and those few permissions.

For letting an AI agent do collaboration chores, fine-grained is the only sane choice. Here is the complete permission set our RescueDogs collaborator needed — and nothing more:

| Permission        | Access           | Why the agent needs it                 |
| ----------------- | ---------------- | -------------------------------------- |
| **Issues**        | Read and write   | Open and comment on issues             |
| **Contents**      | Read and write   | Push commits to branches               |
| **Pull requests** | Read and write   | Open and update pull requests          |
| **Metadata**      | Read (automatic) | Required baseline for everything above |

Notice what is **absent**: no **Administration** (can't change repo settings, add collaborators, or delete the repo), no **Secrets** (can't read your Continuous Integration secrets), and **no access to any other repository**. Scope the token to the single repo, set those four rows, and leave everything else at "No access."

> ✅ **Best practice**: Give the token an expiration — 90 days is a sane default. A token that expires on its own is one you can never forget to clean up. You can always regenerate it.

## 🔨 Setup, Two Ways

There are two ways for the collaborator to connect their own GitHub identity to Cursor. Recommend the first; keep the second in your back pocket.

### Option A: Cursor's Built-In GitHub Sign-In (Recommended)

This is the least error-prone path because Cursor manages the token and its scopes for the collaborator. No copying secrets, no choosing permission checkboxes.

1. Open **Cursor → Settings** (the gear icon, or `Ctrl+,`).
2. Find the **GitHub** or **Integrations** section.
3. Click **Sign in with GitHub** — this opens the browser to authorize the collaborator's account.
4. Approve the authorization. Cursor now acts as the collaborator for GitHub operations.

For most people, that is the entire setup. Skip Option B unless they specifically want to hold and scope the token themselves.

### Option B: A Fine-Grained Token by Hand (Explicit Control)

Use this when the collaborator prefers to manage the credential directly, or when the built-in sign-in isn't available.

1. Go to **[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)** (the path through the UI: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token).
2. **Token name**: something descriptive, like `cursor-rescuedogs`.
3. **Expiration**: a limited window, e.g. 90 days.
4. **Resource owner**: the account that owns the target repo (for us, `TortoiseWolfe`).
5. **Repository access** → **Only select repositories** → pick the single target repo. Do **not** grant all repositories.
6. **Repository permissions**: set exactly the four rows from the table above (Issues, Contents, Pull requests each Read and write; Metadata is auto-selected). Everything else stays "No access."
7. **Generate token**, copy it, and paste it into Cursor or into `gh auth login`.

> ⚠️ **Handle with care**: The token is shown once. Store it in Cursor's credential settings or your password manager. Never paste it into a file in the repo, never commit it, and never send it to anyone — including the maintainer.

## 🧪 Verify It's Really Them

Setup that you don't verify is setup you don't have. Before trusting the agent with real work, confirm three things: who GitHub thinks the collaborator is, that they can actually push, and that issue creation works end to end. The `gh` CLI makes all three quick.

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
# then immediately close the throwaway:
gh issue close <the-number-it-printed> -R TortoiseWolfe/RescueDogs \
  --comment "smoke test passed, closing"
```

If `gh api user --jq .login` prints the collaborator's handle (not the maintainer's), `push` is `true`, and the throwaway issue opens under _their_ name, the identity is wired correctly. The self-closing smoke test proves the full loop without leaving litter behind.

> 💡 **Tip**: The single most important check is `gh api user --jq .login`. If that ever prints the _wrong_ account, stop — a shared or mis-configured credential has crept in, and every action from here would be misattributed.

### 🐛 When Verification Goes Sideways

A few failure modes come up often enough to name:

- **`gh api user --jq .login` prints the maintainer, not the collaborator.** The machine is still authenticated with an old or shared credential. Run `gh auth logout`, then `gh auth login` again with the collaborator's own account or token. Never "just proceed" — every action would be misattributed.
- **`push` is `false` in the permissions object.** The token was created without **Contents: Read and write**, or it was scoped to the wrong repository. Regenerate it with the correct permission table, or, on the built-in path, re-authorize and confirm the repo is in scope.
- **Commits land as an anonymous gravatar with no account link.** The token is correct, but the local `git config user.email` is an email that isn't verified on the collaborator's GitHub account. Fix it with `git config user.email "verified-address@example.com"` using an email listed under their account's email settings.
- **The agent's `gh` calls fail with a 404 on a repo that clearly exists.** For fine-grained tokens, a 404 (rather than a 403) is GitHub's way of hiding resources the token can't see. It almost always means the repository wasn't selected in the token's **Repository access** — not that the repo is missing.

Catching these at the smoke-test stage costs seconds. Catching them after fifty misattributed commits costs an afternoon of `git` history archaeology.

## 📝 The Paste-Ready Prompt: A House Rule

Wiring up identity is half the story. The other half is how you _hand work_ to a collaborator who implements in Cursor. On RescueDogs this became a written house rule, and it is worth stealing.

The rule: **every issue that asks for a code change, and every pull-request review that requests changes, must include a fenced code block the collaborator can paste straight into Cursor's chat** — not just a prose description of the fix.

Why bother? Because a collaborator working in Cursor doesn't want to _translate_ your prose into edits — they want to hand their agent something executable. A ready prompt with byte-exact targets removes the two things that waste the most time: re-deriving what you meant, and whitespace mismatches when the agent tries to find the code you described.

Here is the shape of a good hand-off prompt:

```text
Fix the mobile-responsive auth-form layout. Context: issue #15
(github.com/TortoiseWolfe/RescueDogs/issues/15), PR #13.

The horizontal label rows have no responsive breakpoint, so on phones
the inputs collapse. Make the rows stack on mobile and go horizontal
at sm+, following docs/MOBILE-FIRST.md.

=== src/components/auth/SignUpForm/SignUpForm.tsx ===
Replace:
  <div className="flex flex-row items-center gap-x-6">
with:
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6">

After editing, verify in-container:
  docker compose exec rescuedogs pnpm run type-check
  docker compose exec rescuedogs pnpm run lint
Then check /sign-up at 360px width in the device toolbar.
```

A few details make these prompts reliable:

- **Wrap the prompt in a four-backtick fence** on the GitHub side, not three. The prompt itself often contains triple-backtick code fences or nested class strings; four backticks guarantee GitHub renders the whole thing as one copyable block with a working Copy button.
- **Open with a context line** — the issue or pull-request number and the repo Uniform Resource Locator (URL) — so the agent can pull surrounding context.
- **Give byte-exact find/replace targets**, pulled verbatim from the branch, not paraphrased. Agents match on whitespace.
- **End with verify commands** (type-check, lint) and one concrete manual check.

This paid off immediately. On RescueDogs pull request #13, we reviewed a design change, found a mobile regression, and sent back a request-for-changes review with exactly this kind of block. The collaborator pasted it into Cursor, and his agent applied the suggested fix essentially verbatim. The round trip was one comment and one push.

> ✅ **Bonus discipline**: When you reject a pull request, use GitHub's request-changes review (`gh pr review <n> --request-changes`) rather than pushing fixup commits onto the collaborator's branch. Pushing to their branch erases their authorship — the very thing this whole exercise is about protecting.

## 🔒 Revoke, Rotate, Expire

Credentials are not "set and forget." The same properties that make fine-grained, per-person tokens safe only hold if you maintain them.

- **Expire by default.** We set 90-day expirations above precisely so nobody has to remember to clean up. When a token lapses, the collaborator regenerates it in two minutes — a small tax that beats an eternal credential drifting around.
- **Rotate on any suspicion.** If a token might have leaked — pasted in the wrong window, committed by accident, shown on a screen-share — revoke it and mint a new one. Because it is fine-grained and per-repo, rotation is cheap and the blast radius was already tiny.
- **Revoke cleanly when someone leaves.** This is the payoff for doing it right. Because the collaborator authenticated as themselves, off-boarding is a single revocation of _their_ token, from _their_ account, touching nobody else. Compare that to the shared-token world, where "removing one person" means breaking everyone.

Manage or revoke fine-grained tokens any time at **[github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)**.

Here is the whole discipline as a checklist:

- ✅ Collaborator uses **their own** credentials — never a shared token
- ✅ Token is **fine-grained**, scoped to **one repository**
- ✅ Permissions limited to **Issues, Contents, Pull requests** (write) + Metadata (read)
- ✅ **No** Administration, Secrets, or other-repo access
- ✅ A sensible **expiration** is set
- ✅ Identity **verified** with `gh api user --jq .login`
- ✅ Work handed off via **paste-ready Cursor prompts**
- ✅ Off-boarding is a **single per-person revocation**

## 🎯 Takeaways for Template Forkers

If you fork ScriptHammer — or any template — and bring on a collaborator who works with an AI agent, the pattern is the same every time:

1. **Never share credentials.** A token is an identity; sharing one erases attribution, bypasses 2FA, and makes clean revocation impossible.
2. **Let each person authenticate as themselves**, ideally through Cursor's built-in GitHub sign-in, or with a fine-grained, single-repo token if they want explicit control.
3. **Grant least privilege** — the four permissions the job needs, scoped to the one repo, with an expiration.
4. **Verify the identity** before trusting the agent with real work.
5. **Hand off work as paste-ready prompts**, and reject via request-changes rather than rewriting someone's branch.

None of this is exotic. It is the difference between a repository whose history tells the truth about who built it, and one where every AI-assisted action collapses into a single misattributed blob. When your collaborator's agent opens its first issue and their name — not yours — is on it, you'll know the setup is right.
