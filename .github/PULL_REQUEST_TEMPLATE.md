## What this changes

<!-- One or two sentences. What is different after this merges? -->

## Why

<!-- The problem, not the patch. If there's an issue, link it below instead of restating it. -->

Closes #

<!--
  `Closes #N` if this PR FINISHES the ticket. `Refs #N` if it does not — `Refs` leaves the
  issue open, which is correct for partial work and wrong for finished work (#381, #382 and
  #383 all sat open behind their own merged PR).

  ⚠️ Do NOT write a closing keyword next to an issue number in prose, even to deny it.
  GitHub ignores the negation: "this does not close #575" closed #575, and "`Closes #861` is
  deliberately NOT claimed here" closed #861. If you need to say a PR doesn't finish
  something, don't put the keyword in the same sentence as the number.
-->

## How it was verified

<!--
  Evidence, not assertion. Paste the output that shows it works — and, for anything that is
  supposed to catch a problem, the output that shows it FAILS when the problem is present.
  A check that has only ever been seen passing has not been shown to work.
-->

## Checklist

- [ ] Ran in Docker, not on the host (`docker compose exec scripthammer …`) — never `npm install`, `pnpm install` or `npx` on the host machine
- [ ] `pnpm run lint`, `pnpm test --run` and `pnpm run type-check` pass in the container
- [ ] Commit hooks ran — **no `--no-verify`**
- [ ] New/changed behaviour has a test that fails when the behaviour is removed
- [ ] New components use the generator (`pnpm run generate:component`) and keep all five files
- [ ] Schema changes edit the single monolithic migration, and are idempotent (`IF NOT EXISTS`)
- [ ] No secrets, keys or `.env` values in the diff

<!--
  Seven checks must be green to merge: `Test (20.x)`, `accessibility`,
  `E2E (local) result`, `Conformance result`, `Component Structure result`,
  `Auth Config Drift result` and `Signup Mailer result`. They run in parallel, so the wait
  is set by the slowest (the E2E lane, ~27 min), not by the number of them.
  `Cloud-quota budget` failing is a known, non-required guard on the hosted E2E lane —
  ignore it.

  A first PR does not need to tick every box. Say what you skipped and why; that is more
  useful than a fully-ticked list nobody checked.
-->
