---
title: 'Red From the First Commit: The Test Suite That Never Got Past Smoke'
author: TortoiseWolfe
date: 2026-10-17
slug: red-from-the-first-commit
tags:
  - testing
  - ci-cd
  - github-actions
  - ai-agents
  - e2e
  - workflow
categories:
  - workflow
  - tutorials
excerpt: A fork's end-to-end suite failed or was cancelled on every one of its first 17 runs. It looked like one flaky test. It was a gate at the front of the chain that kept the main suite from ever starting, and when the gate finally opened, real product defects were waiting behind it.
featuredImage: /blog-images/red-from-the-first-commit/featured-og.svg
featuredImageAlt: Red From the First Commit - a CI chain that failed at its first gate and hid everything behind it
ogImage: /blog-images/red-from-the-first-commit/featured-og.png
ogTitle: Red From the First Commit - The Test Suite That Never Got Past Smoke
ogDescription: A fork's E2E suite was red for 21 days and the main suite never ran once. Fixing the one gate at the front revealed five real product defects, and the green that followed was still blind to the bug class that caused it.
twitterCard: summary_large_image
---

# 🚦 Red From the First Commit: The Test Suite That Never Got Past Smoke

_Part of the [AI Workflow series](https://tortoisewolfe.github.io/AI_Workflow/series.html#build-log)._

_Fourth in a series on the assembly line for AI-written code. [Post one](/blog/cursor-github-identity) got the agent's identity right; [post two](/blog/client-email-not-a-spec) turned a client's email into a scoped ticket; [post three](/blog/reject-without-taking-over) sent a flawed pull request back without taking it over. This post is about the check that sits under all of them: the test suite that's supposed to say yes or no._

A red build has a way of becoming furniture. It was red yesterday, it's red today, and somebody calls it a bit flaky. Nobody opens it, because everyone assumes they know what it says.

This is the story of a fork whose end-to-end (E2E) test suite was red from its first run. For 21 days, **not one test in the main suite ever ran.** Not "failed a lot": never started. What looked like one stubborn failure was a chain of jobs that died at the first link, and a long list of real problems sitting quietly behind it.

## 🪝 What Was Red

[ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer) is the template. RescueDogs is a fork of it for a dog-rescue site. The fork was rebranded on 2026-06-09 in a commit titled `chore: rebrand ScriptHammer -> RescueDogs`, and the E2E workflow ran for the first time at 20:10 UTC that evening. A later commit message says the suite had been "red in CI since the first RescueDogs commit," and the run history agrees.

The workflow is a chain. Each job lists what it needs, and by default GitHub skips a job whose dependency didn't succeed:

```yaml
build:
smoke:
  needs: build
rate-limiting:
  needs: smoke
auth-setup:
  needs: smoke
# e2e, e2e-firefox, e2e-webkit:
#   needs: [smoke, rate-limiting, auth-setup]
#   (firefox and webkit also override the skip on any run that isn't a pull request)
# report: runs last
```

That's a sensible design. A cheap smoke test goes first, so a broken build doesn't spend a full browser run finding out what a quick check could have said. The cost of the design is that **a failing gate at the front is indistinguishable from a failing suite.** The run is red either way.

Here's what the history looked like when I pulled it with the GitHub API instead of squinting at the Actions page:

```bash
gh api --paginate repos/TortoiseWolfe/RescueDogs/actions/workflows/e2e.yml/runs
```

- 17 runs between 2026-06-09 and 2026-06-30: **16 failed, 1 was cancelled.**
- In every one, `Build` succeeded and `Smoke Tests` failed (or was cancelled), and `Auth Setup` was **skipped**.
- The main Chromium matrix was skipped every time. On runs that weren't pull requests, Firefox and WebKit started anyway and failed at their "Download auth state" step, because Auth Setup had been skipped, without running a test. On pull requests all three were skipped.

So the status page said "red" 17 times, and often showed a long list of red jobs. Nearly all of it was one failure fanning out: smoke failed, so Auth Setup was skipped, so the browser jobs had no auth to download. Whatever was wrong with the pages behind it couldn't have been reported, because no test behind it ever ran.

> ⚠️ **A red result tells you the chain broke. It doesn't tell you how much of the chain was ever tested.**

## 🩹 The First Diagnosis Was a Symptom

On 2026-07-01 a pull request (PR #7) set out to make the suite green. Its first commit, `630f0259`, is worth reading closely, because it's a good diagnosis of the wrong thing.

The message says the signup tests pass in `next dev` but fail on CI, that React's form handlers attach only after hydration, and that on slow CI runners the tests "filled fields and clicked 'Sign Up' BEFORE hydration, so nothing happened." The fix added a `waitForHydration` helper that probes a controlled input until React round-trips a value, and called it after each navigation in the signup spec.

Every part of that's internally consistent, and the commit says it reproduced locally. It was also not the problem. Smoke still failed on the very next run, and the three browser jobs, Auth Setup and Rate-Limiting stayed skipped.

The signature it chased was real: forms that never respond, with no error. The cause it assigned (slow runners) was a guess that fit. **A theory that explains the symptom isn't evidence that you found the cause.** The test of a cause is that fixing it changes the outcome, and this fix changed nothing visible. That's cheap to notice, because the run is right there. Thirty-eight minutes after the first commit, the second one landed.

## 🎯 The Root Cause, in One Commit

Commit `af29316f` (`fix(e2e): serve basePath-less build so JS loads and forms hydrate`) opens with "THE root cause of the perma-red E2E suite." Its explanation:

- CI built the static export with a base path of `/RescueDogs`, which is how GitHub Pages serves a project site.
- The E2E job then served that build from the **root**, with `serve out -l 3000`.
- So every `/RescueDogs/_next/*.js` request returned 404. The commit says it captured **38 JS 404s** loading CI's own build artifact.
- No JavaScript means no hydration. The commit says every form test failed in the identical, silent way, which is exactly the signature the first commit had seen.

The build step had already tried to switch the base path off with `GITHUB_ACTIONS: false`. The commit message explains why that did nothing: `detect-project.js` keys on `process.env.GITHUB_ACTIONS`, and, it says, the runner re-injects `GITHUB_ACTIONS=true` into the child processes that `pnpm build` spawns. It reports that CI's build log showed `Base Path: /RescueDogs` despite the `false`.

The fix added an unambiguous `DISABLE_BASE_PATH=true` signal that `detect-project.js` honors no matter what `GITHUB_ACTIONS` says, and set it in the E2E build step. A new test guards the other direction, so the real deploy build still gets `/RescueDogs`. The commit reports 23 of 23 passing in that test file, run locally.

### Why the template never had this

At fork time ScriptHammer had a `public/CNAME` file, because it is served from the root of its own domain, and `detect-project.js` auto-detected the prefix only when it was running on GitHub Actions, on a GitHub repository, and **there was no CNAME**. (The template has since moved to reading the custom domain from configuration instead of the file's existence.)

The rebrand commit removed `public/CNAME` on purpose. Its message says "project-pages basePath auto-detection requires no CNAME," and for a site that deploys under `/RescueDogs`, that's right. The message doesn't mention the E2E job, which served the build from the root. A deliberate, correct change to the deploy configuration turned into a failure in the one job that served the build from somewhere else.

## 🪜 Then the Wall Came Down

With the root cause fixed, the main Chromium matrix ran for the first time, on PR #7. Its `chromium-gen` job (six shards) went from "skipped" to doing real work. (Firefox and WebKit stay off pull requests unless the PR is labelled, so all three browsers first passed together on the push to main after the merge.) Here's the sequence of failed shards across the next runs, with what each commit fixed:

| Commit     | What it fixed                                                                                                                          | Failed shards after |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `af29316f` | The base path (root cause)                                                                                                             | 5                   |
| `4af35a43` | **Product:** a `?pet=` preselection that arrived after the adoption form had mounted was ignored                                       | 5                   |
| `666bc0c4` | Test: tracker URL assertion missed the trailing slash                                                                                  | 4                   |
| `1901d93d` | **Product:** the rescue theme missed the project's WCAG AAA 7:1 contrast on `/`, `/status`, `/themes` and `/accessibility`             | 3                   |
| `800c0259` | **Product:** buttons at 40px and 32px under a 44px touch-target gate (a blog SEO button `min-h-8` to `min-h-11`); plus stale test copy | 2                   |
| `f7e5ab78` | **Product:** the footer link told apart from text by colour only (WCAG 1.4.1); plus a stale assertion                                  | 1                   |
| `292f7383` | Mostly tests that still described the template homepage; also `aria-current="page"` added to the nav and asserted                      | 1                   |
| `9517edf5` | **Product:** a blog post pointed at a `rescuedogs-intro` Open Graph image that returned 404 on production                              | 0                   |

Five, five, four, three, two, one, one, zero. The PR merged on 2026-07-01 at 08:09 UTC, and the first green run of the workflow was at 07:41 UTC.

Counting honestly: **five** of those fixes clearly changed the product, and a sixth is borderline. The preselection was a form behaving wrongly for real visitors; contrast, touch targets and link styling were accessibility gates the fork didn't meet; and the missing image was a genuine 404 on production. The borderline one is `aria-current`: a navigation test looked for "aria-current or active class," and the fix added the attribute and made the test assert it. The rest were tests asserting things that had stopped being true, or the harness itself.

The three contrast numbers I'll quote from the commit message are modest misses: footer text went from 5.15:1 to 7.55:1, links from 6.56:1 to 7.13:1, and a stat title from 5.52:1 to 7.66:1, against a 7:1 gate. A page that's 0.4 to 1.9 points short of a contrast gate (the same message lists muted text that was up to 2.8 short) looks fine to everyone, including the owner. The gate exists so nobody has to judge it by eye, and for three weeks nobody could use it.

### The failures in the middle were real signal

When a suite has been red for weeks, there's a pull to read each new failure as more of the same flakiness. Resist it. Across those eight runs the failing set got smaller, and each shard that dropped out did so because a specific commit fixed a specific thing. A flaky suite doesn't behave that way, because its failures come and go regardless of what you change. This one converged.

That convergence is the check you can run in a few minutes: **rerun, and see whether the failures move or just reshuffle.** Moving down means you're removing real causes. Reshuffling means noise.

## 🧪 Green Was Still Blind to the Cause

Here's the part the green run doesn't tell you. The fix made the E2E suite serve the build from the root. That's the one configuration in which this bug class can't appear. The suite got green by **running in the template's configuration**, while the fork's real deployment, a GitHub Pages project site under `/RescueDogs`, was exactly the thing it couldn't exercise.

That wasn't hypothetical. Less than a day after the first green run, on 2026-07-01 at 22:19 UTC, RescueDogs issue #8 was opened: the email-confirmation link redirected to the GitHub Pages domain root instead of into the `/RescueDogs` app. Raw `window.location.href` and `emailRedirectTo` values ignored the base path. That code was inherited from the template, which had the same gap. The issue closed on 2026-07-03.

The suite that had just been fought green couldn't see it, because it never ran where the base path exists. Three follow-ups landed in the template:

- **ScriptHammer #156** made the auth redirects base-path aware (merge commit `e6861e6b`).
- **ScriptHammer #157**, shipped as PR #178 and merged on 2026-07-05, added a Playwright project that serves the build under a base path, with a signup smoke test. Issue #157 calls the whole class of base-path bugs "structurally invisible" to the E2E suite as it stood.
- **ScriptHammer #176** upstreamed the `DISABLE_BASE_PATH` switch from the fork, so the fix for the fork's problem didn't stay in the fork.

The lesson is the one the whole series keeps arriving at, from a different side. In post three, a green suite measured input height while the real defect was width. Here, a green suite served from the wrong place while the real defect lived in the right one.

> 💡 A green check means "the thing the gate looks at is fine." It doesn't mean "the thing you ship is fine." Say which one you checked.

## 🔧 How to Find This in Your Own Repository

You don't need a fork or a rebrand to be in this position. Any chain with a cheap gate at the front can hide everything behind it. Three checks, each a few minutes:

**1. List the last runs and look at what ran, not what failed.**

```bash
gh run list --workflow e2e.yml --limit 30
gh run view <run-id> --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
```

If you see `skipped` next to the jobs that hold your real tests, the suite isn't red, it's _unrun_. That's a different problem, with a different fix.

**2. Find the first red run, not the latest.** The first run after any rename, rebrand, dependency bump or config deletion is the one whose diff has the cause in it. Here it was a deliberate deletion with a commit message that said why, and its effect showed up in a job nobody had linked to it.

**3. When the gate opens, expect a queue.** Plan for the failures behind it to be real, and fix them one at a time with the count visible. The five-five-four-three-two-one-one-zero sequence above is what that looks like when it's going well.

One more rule, from the first diagnosis: **after a fix, the run has to change.** If the next run fails the same job in the same place, then the diagnosis was only a theory, however well it explains the symptom.

## 🎯 Takeaways

1. **Count what ran, not what failed.** A chain that dies at its first gate is red, and it's also silent about everything behind the gate. Seventeen reds in a row were mostly one failure, repeated.
2. **A cause is a fix that changes the run.** The hydration theory explained every symptom and changed nothing. The base-path fix moved the failure count the same hour.
3. **Treat a deleted file as a configuration change.** A removed `public/CNAME` was deliberate and correct for the deploy, and it changed what the build emitted for a job nobody had linked to it.
4. **Failures that converge are signal.** Eight runs went from five failing shards to none, with one cause per step. Don't call that flaky.
5. **Ask what the green run couldn't see.** The suite turned green by serving from the root, which is the one place the original bug can't occur. The next bug in that class was reported within a day, and it had been in the inherited code all along.

The agent that wrote these fixes was fast, and the fixes were right. What a person had to do was look at a wall of red, and notice that the thing it was reporting was mostly one failure counted seventeen times. Then, after it turned green, ask what it had stopped being able to see.

**Part of the [AI Workflow series](https://tortoisewolfe.github.io/AI_Workflow/series.html#build-log).** ← Previous: [Send It Back Without Taking It Over](/blog/reject-without-taking-over/) · Next: [A Merged Security Fix Is Not a Fixed Database](/blog/merged-fix-is-not-a-fixed-database/) → · [Every part, in order](https://tortoisewolfe.github.io/AI_Workflow/series.html)
