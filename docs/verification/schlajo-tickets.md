# Verification tickets — schlajo

Independent verification pass for two open issues. Each section has a **Cursor prompt** you can paste straight into Cursor's chat (Agent mode) to drive the checks, plus manual steps where a human eye or a screenshot is the real signal.

> ### ⏳ PENDING ASSIGNMENT — action needed after invite acceptance
>
> `schlajo` was invited to the repo (**Read** access, invite id `324802601`, sent 2026-07-07) but **has not accepted yet**. GitHub blocks assigning an issue to a non-collaborator, so **#188 and #212 are NOT yet assigned to him.**
>
> **Once schlajo accepts the invite, run:**
>
> ```bash
> gh issue edit 188 --repo TortoiseWolfe/ScriptHammer --add-assignee schlajo
> gh issue edit 212 --repo TortoiseWolfe/ScriptHammer --add-assignee schlajo
> ```
>
> Verify acceptance first with: `gh api repos/TortoiseWolfe/ScriptHammer/collaborators/schlajo` (200 = accepted).
> The Cursor prompts are already posted as comments on both issues, so he can start immediately; this step just sets the formal assignee.
>
> _(Triage was the intended access level but is org-only — this is a personal repo, so Read was used.)_

**Setup (once):**

```bash
# Docker-first — never run pnpm/npm on the host
docker compose up -d
docker compose exec scripthammer pnpm run dev   # http://localhost:3000
```

Test user (from `CLAUDE.md`): `test@example.com` / `TestPassword123!`

> These are **verification** tasks, not implementation. The goal is to confirm the shipped state matches the claim (or produce the evidence that it doesn't). Report findings as a comment on the issue.

---

## #188 — Payment/E2E backlog: confirm it's genuinely drained

**Claim to verify:** the 9 payment/CI sub-tickets (#189–197) shipped, `main` is green across all browsers, and every remaining E2E skip is either a runtime guard or an intentional creds/feature marker — no silent placeholder debt.

**What's already been asserted (your job is to independently confirm):**

- `main` @ `ccdc86c` passed all 24 E2E shards (chromium + firefox + webkit).
- 53 conditional guards (`test.skip(!fixture …)`) that RUN when their condition is met.
- 12 unconditional `test.skip(true, …)` placeholders — all claimed to be creds-gated (Stripe/PayPal live-Checkout) or verify-if-runnable.

### Cursor prompt — paste into Cursor Agent

```
You are verifying GitHub issue TortoiseWolfe/ScriptHammer#188 (payment/E2E backlog drained). Do NOT change any code. Produce a factual report.

1. Confirm the 9 sub-tickets are closed and merged:
   Run: gh issue view <N> --repo TortoiseWolfe/ScriptHammer --json state,title  for N in 189 190 191 192 193 194 195 196 197
   Every one must be CLOSED. List any that aren't.

2. Confirm main is green across the full browser matrix:
   Run: gh run list --repo TortoiseWolfe/ScriptHammer --branch main --workflow "E2E Tests" --json databaseId,status,conclusion,headSha
   Find the most recent completed run on the head of main. Then:
   gh run view <id> --repo TortoiseWolfe/ScriptHammer --json conclusion,jobs
   Confirm conclusion=success and that E2E shards exist for chromium- AND firefox- AND webkit-. Report any failed job.

3. Audit the remaining E2E skips — separate guards from placeholders:
   Run: grep -rn "test.skip(" tests/e2e/
   - Count conditional guards: test.skip(! ...  and test.skip(!! ...   → these are fine (they run when the condition is met).
   - Count unconditional placeholders: test.skip( true ...   → open each and read its reason string.
   For EACH unconditional test.skip(true, ...), confirm the reason is a real blocker:
     - "requires actual Stripe Checkout" / "PayPal sandbox creds" / "real decline" → legitimate creds-gated marker (CI has only dummy keys).
     - Anything else (a route that now exists, a component that now renders, a feature that shipped) → a STALE placeholder that should be finished or deleted. FLAG IT.

4. Report: (a) all 9 closed? (b) main green on all 3 browsers? (c) the exact list of the 12 placeholders with a one-line verdict each (legit-creds-marker vs stale). If all are legit, #188 is safe to close. Post your findings as a comment on #188.
```

### Acceptance for closing #188

- [ ] #189–197 all CLOSED
- [ ] Most-recent `main` E2E run = success, with chromium + firefox + webkit shards present
- [ ] Every `test.skip(true, …)` maps to a real creds/feature blocker (none stale)
- [ ] Findings posted as a comment; @TortoiseWolfe gives the final close

---

## #212 — Horizontal gap between form labels and inputs (auth forms)

**Claim to verify:** the horizontal label↔input cram reported here **does not reproduce in ScriptHammer** — the template forms already stack each label above its input (no side-by-side squeeze). The report was filed from the RescueDogs fork.

**This one needs screenshots** — the markup audit says there's no cram, but a rendered view is the real test. Please capture the actual UI.

### Manual steps (the real signal)

1. `docker compose exec scripthammer pnpm run dev`, sign in as the test user.
2. Go to **Account Settings** → Profile Settings (Display Name, Bio) and Change Password (New / Confirm Password).
3. Screenshot at **three widths**: 320px (portrait phone), 768px (tablet), 1280px (desktop). Use browser devtools responsive mode.
4. Look specifically for: label text touching/overlapping the input border, or a long label (`Confirm Password`) shifting the input column.
5. Repeat on **Sign In** and **Sign Up** forms.
6. Attach the screenshots to #212 and say whether you see the cram **on ScriptHammer** (not just the RescueDogs fork).

### Cursor prompt — paste into Cursor Agent

```
You are verifying GitHub issue TortoiseWolfe/ScriptHammer#212 (horizontal label/input gap on auth forms). The claim is that ScriptHammer's forms already stack labels ABOVE inputs (no horizontal cram) and the reported defect is fork-only. Confirm or refute against the actual code.

Do NOT change code yet — first verify.

1. Read these three files and, for every text field (label + input/textarea pair), report the layout:
   - src/components/auth/AccountSettings/AccountSettings.tsx  (Display Name, Bio, New Password, Confirm Password)
   - src/components/auth/SignInForm/SignInForm.tsx            (Email, Password)
   - src/components/auth/SignUpForm/SignUpForm.tsx            (Email, Password, Confirm Password)
   For each field, quote the exact className on the wrapping div, the <label>, and the <input>. Classify as:
     - "label-above-input": wrapper is a plain block <div>, label on its own line above the control (NO flex-row/grid/float) → no cram possible.
     - "side-by-side-flex-row": label and input on the same horizontal line → check for gap-x-* between them; if absent, that's the cram.

2. If ALL fields are label-above-input, the #212 premise does NOT reproduce in this repo — report that with the evidence.

3. Regardless of the code verdict, the issue needs rendered screenshots to be sure. Note in your report that a human screenshot pass at 320/768/1280px is still required (see the manual steps in docs/verification/schlajo-tickets.md).

4. If — and only if — you find a real side-by-side cram with no gap, propose the minimal fix per the issue's suggested approach (flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6 + a shared sm:w-36 label column), but do not apply it without confirmation.

Post your code-audit verdict + a note on the screenshot requirement as a comment on #212.
```

### Acceptance for closing #212

- [ ] Code audit reported (all fields label-above-input, or a specific cram located)
- [ ] Screenshots attached at 320 / 768 / 1280px for Account Settings + Sign In + Sign Up
- [ ] A clear statement: does the cram reproduce on **ScriptHammer** or only the RescueDogs fork?
- [ ] If fork-only → transfer to `TortoiseWolfe/RescueDogs`; if it reproduces here → fix per the issue's approach

---

_Prepared for schlajo's verification pass. Assignment on the issues is pending his acceptance of the repo invite (Read access). Once accepted, both #188 and #212 will be assigned to him._
