# Phase 1 Quickstart: COMBINED ARMS

**Feature**: 048 — COMBINED ARMS
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Date**: 2026-07-09

Run recipes for each PRD phase's artifact **once its tickets land** — this is how a developer (human or LLM) verifies the thing exists and behaves, not instructions to build it now. Ticket IDs (T0xx) refer to the forthcoming `tasks.md`; each recipe names the gate it serves. Recipes are independently runnable and self-contained.

All commands assume the dev container is running:

```bash
docker compose up -d
# Game-side services (match server, redis, livekit) live under the `game`
# compose profile, mirroring the existing `supabase` profile:
docker compose --profile game up -d
```

Local dev endpoints (in `.env`, gitignored as always — committed files use placeholders):

```bash
NEXT_PUBLIC_MATCH_ENDPOINT=https://localhost:4433   # WebTransport requires TLS even locally (dev cert baked into the compose service)
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

With neither set, `/game/combined-arms` renders the themed "no server configured" state — that is the correct GitHub Pages default, not a bug.

---

## 1. PRD Phase 0 — netcode spike (after the spike tickets land)

The kill-criterion artifact: 16 capsules moving/shooting in a flat graybox with prediction, reconciliation, and lag comp working end-to-end.

```bash
# Match server (one match per process) with the flat spike arena:
docker compose --profile game up matchserver
# Client: dev server route, /game/3d dynamic-import precedent:
#   http://localhost:3000/game/combined-arms?spike
```

**Expected**:

- The route mounts a canvas (WebGPU; check the console banner for the WebGL2 fallback path on unsupported browsers), connects over WebTransport, and spawns your capsule; up to 15 more tabs/clients join the same process.
- Local movement responds instantly (predicted); other capsules move smoothly (interpolated ~100 ms in the past).
- The debug HUD (`?spike` enables it) shows: RTT, input sequence lag, misprediction corrections/min, snapshot bytes/s.

**Kill-criterion measurement** — the whole point of Phase 0:

```bash
# Simulated bad network, server-side (flag on the matchserver service):
MATCH_FAKE_LAG_MS=80 MATCH_FAKE_LOSS_PCT=2 docker compose --profile game up matchserver
```

- Strafe, jump-peek, and track another capsule at 80 ms RTT + 2% loss. Mispredictions must smooth over ~100 ms, never snap or rubber-band.
- Hitscan against a strafing capsule must register where you aimed (lag comp, 250 ms rewind cap): the debug HUD shows server-confirmed hits vs client-predicted hits — they should agree ≥95% under the simulated network.
- **If it feels bad here, STOP.** Do not proceed to Phase 1; the plan's kill criterion says revisit platform choice first.

**WebSocket-fallback check** (same spike, worst-case transport):

```bash
# Force the fallback path client-side:
#   http://localhost:3000/game/combined-arms?spike&transport=ws
```

- The client connects, plays, and the debug HUD labels the transport `ws`. Expect more latency variance (that is the fallback's documented trade), but no functional difference — the server treats both identically.

---

## 2. Capture & ticket math unit tests (with the `shared/rules` tickets)

The Appendix B constants are executable spec — these tests exist before the rules code does (Constitution II):

```bash
docker compose exec scripthammer pnpm vitest run shared/rules shared/protocol
```

**Expected**:

- Capture-meter suite: solo flip −100→+100 in 32 s; 2 attackers ~21 s; 3+ capped at 16 s; contested freeze; 2 pts/s decay toward owner when attackers leave.
- Ticket suite: 1 ticket per respawn, zero per revive inside the 10 s window; majority bleed 1/5 s at ≤2 of 5 CPs; total-control bleed 1/2 s; the B.3 sanity sim reproduced as a test (≈312 tickets drained ≈ 20-minute reference match).
- Flip-event suite: exactly one atomic `{cpId, newOwner, tick}` per ownership change; queued spawns on that CP invalidated in the same tick.
- Protocol suite: quantization round-trips (1 cm positions, 16-bit angles), delta-against-baseline encode/decode identity.

Any tuning change MUST fail here first — edit `shared/tuning.ts` and the test together, and note the playtest evidence in the commit (tuning order: bleed interval, then pool, then respawn cost).

---

## 3. Bake the north-shore map (with the `sites/north-shore.json` ticket)

```bash
docker compose exec scripthammer pnpm bake --site north-shore
# New sites 404 on the dev route until the container restarts (known behavior):
docker compose restart scripthammer
```

**Expected**:

- `public/twins/north-shore/` contains `terrain.json`, `streets.json`, `buildings.json`, `drape.jpg`, `manifest.json`.
- `sites/north-shore.json` is committed and deliberately gitignore-allowlisted (same `!` pattern as chatt — the `sites/*` privacy default stays intact for other sites).
- Author-time check: open the twin viewer with `?topdown` to eyeball CP volumes over real intersections — A over the Coolidge carousel lawn, B at the Walnut St Bridge north landing, C on the hill-climb block, D along Frazier Ave, E on the Renaissance Park knoll. The drape is for THIS step only; the game graybox is untextured.
- Server-side: `matchserver` boots with `MATCH_MAP=north-shore` and logs the heightmap dimensions it loaded — client and server must report identical terrain checksums (printed at connect).

---

## 4. PRD Phase 1 — bot-filled local match (after vertical-slice tickets land)

```bash
MATCH_MAP=north-shore MATCH_BOTS=31 docker compose --profile game up matchserver
# Then join as the 32nd player: http://localhost:3000/game/combined-arms
```

**Expected**:

- Deploy screen (wireframe 01) shows the top-down map, owned-CP spawn markers, class picker, and the 10 s spawn-wave timer; bots fill both teams.
- Walk into CP B's radius: capture meter neutralizes then flips at the tuned rates; on the flip, deploy-screen ownership swaps within one RTT, with map flash + audio sting + banner.
- Scoreboard (wireframe 03) shows both ticket pools draining by respawns; put the enemy below 3 CPs and watch bleed tick at 1/5 s.
- Squad flow: create a squad, have a bot-squad member spawn on you; take damage and verify leader spawn denies for exactly 8 s. Toggle the SQ-4 presentation flag and confirm both variants render:

```bash
MATCH_SQ4_VISIBLE_TIMER=true  docker compose --profile game up matchserver   # countdown variant
MATCH_SQ4_VISIBLE_TIMER=false docker compose --profile game up matchserver   # opaque variant
```

- Telemetry: after the match, `server/telemetry/` (volume-mounted in dev) has a JSONL with death heatmap points, per-CP flip counts, squad-spawn locations, and time-to-first-contact (SC-011).

---

## 5. PRD Phase 2 — voice smoke (after LiveKit tickets land)

```bash
docker compose --profile game up livekit matchserver
# Two browsers (not two tabs — mic capture), both join the same squad.
```

**Expected**:

- Joining the squad auto-joins its voice channel with zero configuration; PTT default.
- Holding PTT in browser A lights the speaking indicator on B's roster (wireframe 02) and flashes A's name overhead.
- As squad leader, hold the command-PTT key: a leader in ANOTHER squad hears you; your own squad channel does not.
- Negative test (VC-3): grab the squad-X token from devtools and attempt a `livekit-client` join to squad Y's room — the SFU must reject it.
- Kill the livekit container mid-match: the match keeps playing; the roster shows the channel-unavailable state and reconnects when the service returns.

---

## 6. Bandwidth & tick verification (Phase 1 gate; re-run at Phase 3 scale-up)

```bash
# Server-side truth: per-client send-rate and tick timing from the stats endpoint:
curl -s http://localhost:9090/debug/stats | jq '.tickMsP99, .clients[].downBytesPerSec'
```

**Expected**:

- With 32 players (31 bots + you) in active combat: every client ≤20,480 bytes/s downstream (NFR-001); `tickMsP99` well under 33.3 ms (NFR-002).
- Client-side cross-check: `chrome://webtransport-internals` (or the debug HUD's bytes/s counter) agrees with the server figure within ~10%.
- At Phase 3, repeat with `MATCH_BOTS=63` — budget rises to ≤40 KB/s, tick must still hold. This recipe is the go/no-go gate for the 32v32 scale-up.

---

## 7. E2E + accessibility (chrome surfaces only)

```bash
docker compose exec scripthammer pnpm exec playwright test tests/e2e/combined-arms/
docker compose exec scripthammer pnpm test:a11y
```

**Expected**:

- Playwright: menu route loads; deploy screen renders CP markers from a fixture snapshot; squad menu opens on its one-key binding; WebSocket-fallback path connects when WebTransport is unavailable (context flag).
- Pa11y: the main-menu and deploy-screen routes ARE audited (DaisyUI chrome, 44px targets); the in-match canvas route is excluded in `config/pa11yci.json` with the documented reason, exactly like `/game/3d`. `/game/3d` itself shows no regression.

---

## 8. Static-export verification

```bash
docker compose exec scripthammer pnpm run build
docker compose exec scripthammer ls out/game/combined-arms/
```

**Expected**:

- `out/game/combined-arms/index.html` exists; the sim/Three.js chunk is route-split (other routes' First Load JS unchanged — same discipline as 047).
- Nothing server-side leaked into the export: no `src/app/api/` routes exist; the client reads `NEXT_PUBLIC_MATCH_ENDPOINT` / `NEXT_PUBLIC_LIVEKIT_URL` and renders a themed "no server configured" state when they're unset (GitHub Pages default until public servers exist).

---

## Debugging pointers

- **Rubber-banding on your own capsule**: prediction and server are running different sim code — check that `shared/` is the single source (no copy-paste drift) and the terrain checksums at connect match.
- **Choppy remote players**: interpolation buffer starved — the debug HUD shows snapshot inter-arrival; >100 ms gaps mean AoI/priority is starving that entity or the fake-loss flag is still set.
- **Flip felt late or a spawn completed at a lost flag**: that is a B.4 contract bug, not tuning — check the reliable-stream event vs the tick that invalidated queued spawns. This is the "poisons trust in the core mechanic" failure; treat as P0.
- **Voice joins the wrong room or a stale room**: room lifecycle is provisioned by the match server, not the client — inspect the JWT claims (match ID + squad ID) before suspecting LiveKit.
