# E2E parity baseline

`baseline-de0f7f0.json` is a per-test record of the **last green E2E run against the
cloud Supabase project** before #567 exhausted the quota.

It exists because #575 moves E2E onto a per-runner ephemeral Supabase, and that switch is
only safe if the local suite runs **the same tests**. This file is what "the same tests"
is measured against.

|          |                                                               |
| -------- | ------------------------------------------------------------- |
| run      | 31048279017                                                   |
| SHA      | `de0f7f080c8d75949e4e6c89fdf66ab7d3da8029`                    |
| captured | 2026-08-06                                                    |
| backend  | cloud                                                         |
| tests    | 2001 — **1807 expected, 194 skipped, 0 flaky**                |
| projects | `{chromium,firefox,webkit}` × `{gen, msg, msg-iso}` = 24 jobs |

## Why it is committed rather than fetched

The source artifacts expire **2026-08-12T22:13Z**. After that the run's per-test detail is
unrecoverable — and the obvious fallback does not work: the `github` reporter only
annotates failures, so a green run leaves **6** check-run annotations, not 2001. Verified,
not assumed.

The next cloud run that could regenerate this is impossible until the quota refills on
**2026-09-02**. So this file was captured inside the window and committed.

## Why per-test identities, not counts

A suite can drop one test and gain another and still total 2001. Counts would pass that;
`scripts/e2e-parity-diff.mjs` compares identities and rejects it. There is a test for
exactly that case (`same COUNT but different tests still fails`).

This matters concretely here. **228 tests** — all 76 `*-msg-iso` per browser — sit behind
`test.skip(!fixture, 'isolation seed failed…')`, and `seedIsolatedAdmin`
(`tests/e2e/utils/test-user-factory.ts:2761-2772`) returns `null` on two silent paths
before reaching its loud `throw`. If the local stack cannot seed them, all 228 skip
quietly and the run is green. That is the failure this baseline exists to catch.

## Direction matters

The comparison is deliberately asymmetric:

- `expected → skipped`, or a test **missing entirely** — coverage **lost**, fails.
- `expected → unexpected`/`flaky` — a real regression, fails.
- `skipped → expected` — a **gain**; reported, allowed. A local stack can legitimately run
  something the cloud project could not.

## Usage

```bash
# after a run, merge the shards then diff
pnpm exec playwright merge-reports --reporter=json ./all-blob-reports > merged.json
node scripts/e2e-parity-diff.mjs merged.json

# prove the comparator can still fail before trusting a pass
node scripts/e2e-parity-diff.mjs --selftest
```

## Known caveats

The 194 skips are **not** uniform across browsers — 60 chromium / 70 firefox / 61 webkit.
Those 11 are browser-keyed and port cleanly. The rest are environment-keyed (66
admin-dashboard, 27 avatar upload, 54 payment) and are the ones that could flip on a
different backend, in **either** direction. At least one is already known to:
`debug/capture-decryption-logs.spec.ts` skips on cloud and is expected to run locally, so
a small `gained` set is anticipated, not a bug.

**Regenerating this file invalidates every claim that quotes 1807/194/2001** — including
`scripts/__tests__/e2e-parity-diff.test.js`, which asserts those three numbers precisely
so a silent regeneration cannot pass unnoticed.

### 18 entries are now INTENTIONALLY missing on local-lane reports (#725)

Six tests in `tests/e2e/security/oauth-csrf.spec.ts` carry `{ tag: '@hosted' }`, and
`e2e-local.yml` passes `--grep-invert='@hosted'`. They wait for a redirect to a real OAuth
provider, which a local Supabase never performs.

`--grep-invert` removes tests from the report **entirely** — unlike `test.skip()`, which
would record them as `skipped`. So a local-lane report diffed against this baseline yields
**18 `missing` entries** (6 tests × chromium/firefox/webkit-gen), which `e2e-parity-diff.mjs`
treats as `COVERAGE LOST` and exits 1 on. That is correct behaviour for the tool and the
wrong verdict for this situation — the coverage moved rather than vanished.

**So do not wire `e2e-parity-diff.mjs` into the local lane until it grows an allowlist**
carrying a written reason per excluded identity. The three baseline blocks are at lines
373-379 (chromium-gen), 1040-1046 (firefox-gen) and 1707-1713 (webkit-gen); the seventh
entry in each block — `OAuth buttons should be visible and enabled on sign-in page` — is
deliberately **not** excluded and must keep matching.

The baseline cannot simply be regenerated to absorb this: its source artifacts expired
2026-08-12 and the cloud quota does not refill until 2026-09-02.

Consequence for the counts, if anyone re-runs the local lane on `de0f7f0` itself: the
tier-2 comparison in `e2e-local.yml` would see **1789** passed rather than 1807, with
`skipped` and `flaky` unchanged. Tier 2 only fires on that SHA, so nothing reads this
today — but the number is wrong the moment someone does.
