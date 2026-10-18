---
title: 'A Merged Security Fix Is Not a Fixed Database'
author: TortoiseWolfe
date: 2026-10-17
slug: merged-fix-is-not-a-fixed-database
tags:
  - security
  - supabase
  - row-level-security
  - ai-agents
  - postgres
  - workflow
categories:
  - workflow
  - tutorials
excerpt: A one-line Row Level Security hole let any signed-in user seat themselves in any group conversation. The fix merged within three hours of its pull request opening, then had to reach a fork's code, and then the fork's live database, which took another 11 days. Then the same gap turned up inside the original project.
featuredImage: /blog-images/merged-fix-is-not-a-fixed-database/featured-og.svg
featuredImageAlt: A Merged Security Fix Is Not a Fixed Database - a fix merged in code but not yet applied to the live database
ogImage: /blog-images/merged-fix-is-not-a-fixed-database/featured-og.png
ogTitle: A Merged Security Fix Is Not a Fixed Database
ogDescription: "A Row Level Security fix has three places to land: the template's migration, each fork's migration, and every live database. Merging reaches the first one. Here is how to prove the other two, with a real timeline."
twitterCard: summary_large_image
---

# 🔐 A Merged Security Fix Is Not a Fixed Database

_Part of the [AI Workflow series](https://tortoisewolfe.github.io/AI_Workflow/series.html#build-log)._

_Fifth in a series on the assembly line for AI-written code. [Post four](/blog/red-from-the-first-commit) was about a test suite that reported red while hiding what was behind it. This one is about the opposite trap: a change that reports done, with a merged pull request and green checks, while the system it was meant to protect is exactly as exposed as before._

A security fix has an unusual property. A feature that's merged but not deployed is simply not shipped yet, and everyone can see that. A security fix that's merged but not applied looks **finished** and leaves the hole open, and nothing on the screen tells you the difference.

This post follows one fix through three places it had to land. It reached the first within hours of the pull request opening and the last about twelve days after that. At the end, the same gap turned up inside the project that had written the fix.

## 🕳️ The Hole

The project is [ScriptHammer](https://github.com/TortoiseWolfe/ScriptHammer). It's a template, and forks copy it. Its messaging feature has group conversations, and the table that records who belongs to which group is `conversation_members`. A pre-work ticket filed on 2026-06-27 described a privilege escalation in that table's INSERT policy. The ticket said plainly that it was confirmed by static analysis only, and that the exploit had not been run live.

The policy ended like this:

```sql
FOR INSERT WITH CHECK (
  is_conversation_member(conversation_id)
  OR user_id = auth.uid()  -- Self-join on creation
);
```

Read the second line as the database reads it. `WITH CHECK` decides whether a row may be inserted. The first branch says "you may add someone to a group you're already in." The second says "you may add **yourself** to any group." Nothing says the group has to be one you created. The comment describes the intent, which was to let a creator seat themselves while a new group is being built. The code allows far more.

The consequence follows from how the rest of the schema decides who can read. The roster, the per-member encrypted keys and the messages all check `is_conversation_member()`. So one forged membership row exposed the roster and the stored messages, which are end-to-end encrypted, and it put the attacker in line for any group key an owner's client later handed out. The pull request put it more strongly: it's "the master key to a group's roster, per-member encrypted keys, and full message history." Read precisely, a forged member could read only the key rows addressed to themselves, so the ciphertext stayed ciphertext unless a key followed.

The part worth noticing is where the protection was supposed to live. The application's TypeScript service layer checks that two people are connected and have agreed before it adds anyone. A client holding its own valid token can skip that layer entirely and talk to the database through its REST API. **A check that exists only in the code that's polite enough to call it isn't a check.**

## 🔬 Prove It Where It Is Enforced

The fix is [ScriptHammer PR #161](https://github.com/TortoiseWolfe/ScriptHammer/pull/161), merged on 2026-07-03. The PR records something that's easy to skip: the attack, run against the live project, with a result from before the fix and another from after.

The attacker is simulated at the database layer. In outline, the probe sets the role to `authenticated`, sets the JWT claims Postgres reads, and tries the insert, all inside a transaction that's rolled back:

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
                  '{"sub": "<attacker id>", "role": "authenticated"}', true);
-- try to insert a conversation_members row for the attacker
-- into a group they did not create
ROLLBACK;
```

That's the shape, not the exact script. The result is what matters: **before the fix, the outsider's self-insert succeeded. After the fix, it was blocked.** The PR records that the two legitimate paths, a creator seating an owner and a creator seating a member, still passed.

The PR also records something that would have gone wrong with an ordinary test. A client test written with the `supabase-js` library didn't reliably reproduce the problem. The HTTP client path refused the self-insert for an unrelated reason, which the PR says would give a false all-clear. A client test as the first check would have declared the hole closed, or declared that it never existed.

> ⚠️ **Test a security rule at the layer that enforces it. A client that fails for the wrong reason looks exactly like a rule that works.**

### The fix

The second branch became a different question: not "is this row about me" but "did I create this group."

```sql
FOR INSERT WITH CHECK (
  is_conversation_member(conversation_id)
  OR is_conversation_creator(conversation_id)
);
```

`is_conversation_creator` is a small helper that reads `conversations.created_by`. It has to be `SECURITY DEFINER`. For ordinary users, the `conversations` SELECT policy only exposes one-to-one rows, so a group's creator can't see their own group row under RLS, and an inline `EXISTS` subquery would return nothing and wrongly reject the real creator.

### What the committed test does and does not do

The PR added `tests/rls/group-isolation.test.ts`, and the RLS suite went to 60 passing (55 existing, 5 new). The PR also reports that reverting the helper to always return true makes the "rejects a non-creator" assertion fail, so the test does guard that predicate.

It's fair to say what the file is. It calls the helper through a service client and checks that an outsider can read neither the roster nor the keys. It does **not** itself replay the simulated-JWT insert, which was done by hand for the live proof. A test that guards the helper and a proof that the policy blocks the attacker are two different things, and both are worth having.

## 🌍 Three Places a Fix Has to Land

Here's the question the merge button doesn't answer: merged into what?

| Where                                 | What lands there        | How it got there                                    |
| ------------------------------------- | ----------------------- | --------------------------------------------------- |
| The template's migration file         | The policy text         | PR #161, merged 2026-07-03 at 19:01 UTC             |
| Each fork's migration file            | The same text           | Cherry-pick: RescueDogs PR #11, merged at 19:26 UTC |
| **Every live database, one per fork** | The policy as it _runs_ | Someone with access applies it. No merge does this. |

The template's own pull request says it directly: forks that inherit the migration "get the fix on their next apply," and the vulnerable policy was present in every fork until they did. The cherry-pick into the RescueDogs fork applied cleanly. Its description spells out the remaining step: the live database is separate and needs a human.

That last row is where the time went. The fork's live Supabase project sat in a different account from the one the tooling that wrote the fix could reach. So the cherry-pick PR flagged the step, and a separate issue, RescueDogs #12, titled as a security item, was opened on 2026-07-03 at 22:37 UTC. It was closed on **2026-07-15 at 16:29 UTC** by a collaborator whose comment says the change was applied through the Supabase Management API, and who posted the policy text from before and after:

```text
before: (is_conversation_member(conversation_id) OR (user_id = auth.uid()))
after:  (is_conversation_member(conversation_id) OR is_conversation_creator(conversation_id))
```

From the code merging in that fork to the issue closing was **11 days and 21 hours**. This post doesn't claim anyone used that window against anyone. It claims that the window existed, that the merged code was reassuring throughout it, and that a separate, named issue is what made the remaining step trackable.

Notice the shape of the safeguard. The fix didn't rely on someone remembering. The pull request said the live database needed a step, and the step got an issue with a title that said what it was and where. Eleven days is slow, but a tracked step is something you can chase. An untracked one is a hole with a reassuring merge on top of it.

## 🔁 The Same Gap, Inside the Original

You would expect the project that wrote the fix to be the one place this doesn't happen. It happened there too.

On 2026-08-28 ScriptHammer merged a change that put column-scoped grants on `user_profiles`, because the `is_admin` column had been writable from a browser (PR #984). On 2026-08-31, issue #1038 recorded what a live check found: **the block was in the migration file and not in production.** Measured against the live database:

- `has_column_privilege('authenticated', …, 'is_admin', 'UPDATE')` returned true, and so did the same check for `anon`.
- The `Users update own profile` policy had no `WITH CHECK`.
- The table had 23 profiles and one admin, and there was no evidence that anyone had exploited it.

Nothing applied the migration to the running project, and two things kept that hidden. Both are worth stealing the fix for.

**The test was green, and pointed at the wrong database.** `tests/rls/user-profiles-grants.test.ts` connects to `SUPABASE_DB_HOST ?? 'supabase-db'`, which is the local container built fresh from the migration. Of course it passed. It tested what a new database gets from the file, which is exactly the thing that was correct. Production was never in the room.

**The drift check was green, and covered one table of nineteen.** A daily workflow compared production against the repo's intent, but its intent was a hand-written list with a single table in it, and `user_profiles` wasn't on the list. PR #1042 describes it exactly: "A green result meant 'one table matches the repo' and read as 'production matches the repo'."

The fix in #1042 didn't widen the list. A list kept in step with the migration by memory is a second copy of the intent, and it fails quietly in the worst direction: after a security fix, a check asserting the old intent keeps passing because production hasn't moved. The intent is now **parsed from the migration**. The check went from one table to 19, from 5 policy names to 75 policies compared by name and role, from no functions to 25 compared by name and arity, and from table grants to table and column grants.

The gap itself was fixed on 2026-08-31 by applying the migration's statements in a single transaction, and the issue closed when #1042 merged that day. The fix was verified by attempting the escalation as `authenticated` in a transaction that was rolled back, which returned `42501: permission denied for table user_profiles`. That's the same method as the first proof: try the attack, where it's enforced, and look at the refusal.

## 🪦 The Fix That Was Itself Retired

One more turn, because it's the honest end of the story. The helper from PR #161 didn't survive.

Work on the group-authorization family, tracked in #1247, found that `is_conversation_creator` answers "did I create this conversation," and that's **true forever**. A creator the owner later removed could re-seat themselves. The July fix had closed the hole it was written for, and the helper it introduced carried a weaker version of the same idea. The migration now says so in a comment and drops the function:

```sql
DROP FUNCTION IF EXISTS is_conversation_creator(UUID, UUID);
```

Issue #1247 calls the first part B1. B1 (#1294) replaced the creator branches with helpers that grant founder rights only before anyone holds a seat in the group (the founder included). The migration in B2's second stage (#1300) dropped the function, because nothing called it any more and it was still an anonymous-executable `SECURITY DEFINER` function. Both were applied to production on 2026-09-24, and #1300's migration was first run as real roles in a probe that rolled back. The issue records that nobody had used group messaging on production, so nothing live could have been affected, and that every hole it describes had still shipped in the template to every fork.

That's the argument for writing the change history as honestly as the fix. A fix that was correct for the attack in front of it, and was later found to be too generous in the ways it let the creator in, isn't a failure. It's the normal life of a security rule, and it only stays visible if each step says what it did and didn't cover.

## ✅ A Checklist That Fits on a Card

None of this needs more tooling than a SQL console and a ticket tracker.

1. **Reproduce the attack at the enforcing layer, red first.** For RLS that means a rolled-back transaction as the `authenticated` or `anon` role with claims set. Don't trust a client test that can fail for another reason.
2. **Write down every place the fix has to land.** The template, every fork and every live database are separate rows. Give each live database its own issue, with a title that says what it's.
3. **Verify each live database by attempting the attack on it.** Reading the migration file proves what a new database would get. Only the attempt proves what _this_ one does.
4. **Point the test at the right database, and say which.** If a test can only see a fresh local container, its green means "the file is right," and nothing more.
5. **Derive the intent from the migration.** A hand-maintained list of what production should look like is a second thing to forget.

## 🎯 Takeaways

1. **"Merged" and "applied" are different states.** The code merged on 2026-07-03. The live fork database changed on 2026-07-15.
2. **A client test can pass for the wrong reason.** The self-insert was blocked by an unrelated failure in the HTTP path, which is how a real hole gets a false all-clear.
3. **A tracked step is a visible step.** RescueDogs #12 made the 11 days between merge and apply something a person could see and chase.
4. **A green test is only as wide as the database it connects to.** The profile-grants test was green for as long as production was wrong.
5. **A fix has a shelf life.** The helper that closed the July hole was retired in September for being true forever. Date your fixes, and re-read them.

The agent can write the policy, prove it against a throwaway transaction and open the issue for the step it can't take. It can't be the one to decide that "applied" has been checked on the database that matters. That check is a question to ask, out loud, on the day the pull request merges.

**Part of the [AI Workflow series](https://tortoisewolfe.github.io/AI_Workflow/series.html#build-log).** ← Previous: [Red From the First Commit](/blog/red-from-the-first-commit/) · [Every part, in order](https://tortoisewolfe.github.io/AI_Workflow/series.html)
