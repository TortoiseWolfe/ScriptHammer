---
title: 'Claude Code: I was paying the head chef to chop onions'
author: TortoiseWolfe
date: 2026-09-30
slug: head-chef-line-cooks
tags:
  - claude-code
  - ai-agents
  - workflow
  - git-worktrees
  - cost
categories:
  - engineering
  - workflow
excerpt: One expensive model decides, cheaper ones cook in their own copies of the repo, and tests check every plate. Learn how the first run cost about 41% less.
featuredImage: /blog-images/head-chef-line-cooks/featured-og.png
featuredImageAlt: A map of the AI workflow. An Opus head chef hands a goal to a line of stations (plan, cooks, tests, blind taste, GitHub), with a free review panel behind a privacy gate, Muse notes over Gmail, OpenClaw on the side and a per-client ledger.
ogImage: /blog-images/head-chef-line-cooks/featured-og.png
ogTitle: 'Claude Code: I was paying the head chef to chop onions'
ogDescription: One expensive AI model decides and tastes, cheap ones cook in their own copies of the repo, and tests check every plate. The first real run cost about 41% less than doing it all on the expensive model.
twitterCard: summary_large_image
---

Someone gave me good advice about my AI setup this week. Stop using the expensive model for grunt work. Let it plan and review, and let cheaper helpers do the typing.

So I sat down to act on it, and in the first hundred minutes I burned 5% of my weekly limit doing it.

That's the funny part. The rest of this post is what I built once I stopped laughing, and the numbers from the first real run.

## 🔍 The advice was right, my kitchen was wrong

The advice came from an AI chat, and the core of it holds up. A model that's good at architecture and hard debugging costs more per step than one that's good at renaming a variable. Paying top rate for renames wastes the plan.

Where it went wrong was the "cheap local agents" part. My graphics card (Graphics Processing Unit, GPU) has 8 GB of video memory (VRAM), and the desktop keeps about 1.2 GB of that. [Ollama](https://ollama.com/)'s own docs say coding agents need at least 64,000 tokens of working memory, and the models it suggests need roughly 19 to 23 GB at that size. Back in February a mid-size local model on this same card fumbled its tools and drifted into other languages. Local models weren't going to be my line cooks.

The cheap cooks were already in the plan I pay for. [Claude Code](https://www.anthropic.com/claude-code) can run helpers on smaller [Claude models](https://www.anthropic.com/claude), and Anthropic says it plainly: "Opus costs several times more per turn than Sonnet, and Sonnet more than Haiku."

## 🔨 How the kitchen works

![A map of the workflow. The head chef, Claude Code on Opus, hands a goal to the line: an Opus planner writes specs, Haiku or Sonnet cooks work in separate git worktrees, tests in Docker decide pass or fail, a Jev check and a free review panel behind a privacy gate are logged on the side, and a blind Opus reviewer tastes before merge and push. Only results come back to the head chef. Muse exchanges notes through Gmail, OpenClaw runs on a free model and short commands that I approve, and a per-client ledger tracks tokens and time.](/blog-images/head-chef-line-cooks/kitchen-map.png)

There's a head chef, which is my main Claude Code session on Opus. It holds the plan, not the work.

When I have a batch of small, well-defined changes, the head chef hands the whole batch to the line:

1. **Plan.** Opus reads the repo and writes a spec for each task: exact values, exact files, and a test that proves it's done.
2. **Cook.** Each task goes to Haiku or Sonnet, working in its own [git worktree](https://git-scm.com/docs/git-worktree), a separate copy of the repo, so nobody bumps elbows.
3. **Test.** The repo's own tests run in [Docker](https://www.docker.com/), and code decides pass or fail. The cook's word doesn't count. If a cook fails twice, the task goes to a stronger cook.
4. **Taste.** A fresh Opus reviewer sees the spec and the diff, and nothing else. It passes the work or sends it back, twice at most.
5. **Ship.** The head chef merges and pushes.

The part that matters most for cost: only results come back to the head chef. Each cook's working history gets thrown away when its job ends.

The full map, with notes on every part, a dark mode and a printable PDF, is here: **[TurtleWolfe's AI Kitchen](https://tortoisewolfe.github.io/AI_Workflow/05-advanced-orchestration/ai-kitchen-map.html)**.

## 🧪 Does the taster actually taste?

A reviewer that passes everything is worse than no reviewer, so I tested it.

I slipped in a wrong measurement on purpose. The spec said 5/8 inch plywood is 19/32 actual, and I changed it to 9/16. Then I edited the test to agree with the wrong number, so every test still passed.

The blind reviewer caught it. It named the exact line, and it flagged that the test had been changed to protect the error.

## 🎯 The first real run

Five small tasks in a real repo:

- ✅ **Four of five came back right the first time.** They passed the tests and the taste, with zero escalations to a stronger cook.
- ⚠️ **The fifth failed for a reason worth knowing.** It updated a README describing a Dockerfile that a different cook was changing at the same moment. Tasks that depend on each other can't run side by side, so the planner now merges them into one task.
- 💡 **The planner overreached.** While writing the specs it built and tested one of the tasks itself, which was most of the bill. It now runs read-only.

The cost came to about **41% less** than the same work done entirely on Opus, measured at Application Programming Interface (API) prices. My plan doesn't publish its own weighting, so treat that as a ratio, not a promise.

## 💡 A penny-per-hundred yes/no check

There's one more station, and it's on probation. [Jev](https://typesafe.ai/) is a model that only answers yes or no, fast and very cheap. A check costs about a hundredth of a cent.

It's only useful if you ask it narrow questions. When I asked "does this change meet every criterion?", it scored the correct change 0.72 and the planted bug 0.70, which is useless. When I asked whether the code for 5/8 plywood reads `actual: 19.0 / 32`, it scored 0.99 against 0.03.

Right now it runs in shadow. Its answer gets logged next to the Opus reviewer's verdict and decides nothing. If they keep agreeing, Jev can start skipping reviews on the clear passes, and that's where the real savings are.

## ⚠️ What actually cost me the most

It wasn't the models. It was the conversation.

Every turn, the AI rereads the whole conversation. My long planning session grew huge, and it was most of a $49 day on its own. On top of that, the built-in research helpers were quietly running on the expensive model, and they were about a third of the day's usage.

The fixes are boring:

- **Research helpers run on Sonnet.** It's one setting.
- **Every task starts a fresh session.**
- **The head chef stays thin.** It holds the plan, and the cooks hold the work.

## 🆕 Update, October 1: free experts join the line

A day later, a few things moved.

**Jev passed its first test.** Across two real runs it agreed with the Opus reviewer on 6 of 6 changes. It's still in shadow, and it now only ever sees a cleaned-up copy of the change. On client repos it doesn't run at all.

**The line got a free tasting panel.** Seven free models now review every change next to Opus: two on Groq, one on Cloudflare, Gemini, Google's Antigravity CLI, a free model on OpenRouter, and one running on my own GPU. They work in parallel, take about half a minute, and cost nothing.

Free usually means the provider keeps what you send, so a privacy gate sits in front. It scans for secrets and stops the review if it finds one. It strips emails, phone numbers, addresses and names I list. And it sorts repos into three groups. Public code can go to every expert. My own private code only goes to the ones that don't train on it. Client code never leaves my machine: only the model on my GPU sees it.

The panel has to earn its place, the same way Jev did. For now it only records whether it agrees with Opus. On its first night, Gemini rejected a perfectly good change twice, and Groq and the local model got it right. After 15 changes with no wrong passes, it can take over the first round of review, and Opus only steps in when the panel objects.

**And now I can see what each client costs me.** A small ledger reads Claude Code's own records and totals tokens, my time and commits per client. So when I quote the next job, I'm working from what the last one actually took, not from memory.

The setup tutorial covers all of it step by step: **[Build Your AI Kitchen](https://tortoisewolfe.github.io/AI_Workflow/05-advanced-orchestration/setup-tutorial.html)**.

## 📝 Steal it

Everything is public:

- **[The AI Kitchen map](https://tortoisewolfe.github.io/AI_Workflow/05-advanced-orchestration/ai-kitchen-map.html)**: the whole setup on one page, with notes on every part.
- **[Head chef, line cooks](https://tortoisewolfe.github.io/AI_Workflow/05-advanced-orchestration/head-chef-line-cooks.html)**: the longer write-up, including a claim-by-claim check of the original advice.
- **[The AI Workflow curriculum](https://tortoisewolfe.github.io/AI_Workflow/)**: how I got here, starting from day one.

The four rules, if you only take one thing:

1. The expensive model decides and tastes. Cheap models cook.
2. Tests come before taste, and code checks the plate, not the cook's word.
3. Keep the head chef thin and the cooks disposable.
4. Anything I have to do by hand comes as one step, with the link.
