# Tasks: COMBINED ARMS

**Branch**: `048-combined-arms` · **Generated**: 2026-07-09
**Spec**: [spec.md](./spec.md) · **PRD**: [combined-arms-prd.md](../../../combined-arms-prd.md) (Draft v0.1 — §7 phasing, Appendix A netcode, Appendix B tuning math, Appendix C lattice)
**Wireframes**: [01-deploy-screen](./wireframes/01-deploy-screen.svg), [02-squad-hud](./wireframes/02-squad-hud.svg), [03-scoreboard-tickets](./wireframes/03-scoreboard-tickets.svg) — MUST pass review before `/speckit.plan` (Constitution v1.0.2 Principle III)

> **These are FUTURE-implementation tickets.** Nothing is being built in this session — this file is the dependency-ordered ticket backlog that later `/speckit.implement` sessions execute, phase-gated per PRD §7. **No Phase 1 ticket may start until T012 (the Phase 0 kill criterion) passes.**

**Format**: `[ID] [P?] [Story] Description` — [P] = parallelizable (different files, no dependency). Story tags: US1–US5 from spec.md; INFRA for cross-story plumbing.

**Path conventions**: authoritative server lives in `game-server/` at repo root (separate deployable — NOT a Next.js API route; the static-export client shell stays GitHub-Pages-compatible). Client simulation (plain TS, outside React's reconciler) in `src/lib/combined-arms/`. UI chrome (5-file pattern) in `src/components/combined-arms/`. Route at `src/app/game/combined-arms/page.tsx` per the 047 `/game/3d` precedent.

---

## Phase 0 — Netcode Spike (KILL CRITERION gate, PRD §7 Phase 0)

**Goal**: 16 capsules moving/shooting in a graybox with prediction, reconciliation, and lag comp working over WebTransport. Proves (or kills) the platform before anything else is built.

**⚠️ GATE**: T012 is the kill-criterion evaluation. It MUST pass before any Phase 1 ticket starts.

- [ ] T001 [INFRA] Scaffold the match server: `game-server/package.json` (Node 22 / TypeScript strict), `game-server/tsconfig.json`, `game-server/Dockerfile`, and a `match-server` service in `docker-compose.yml` (own port, no dependency on the `scripthammer` app container). One match = one process (PRD A.4).
  - **Acceptance**: `docker compose up match-server` boots, healthcheck endpoint answers, `docker compose exec match-server pnpm test` runs.
  - **Test**: Vitest wired inside the container; CI job builds the image.
- [ ] T002 [INFRA] Implement the 30 Hz authoritative fixed-tick loop in `game-server/src/tick.ts`: fixed timestep with drift correction, tick counter, per-tick phase hooks (input → simulate → snapshot). Server owns all truth (NFR-002).
  - **Acceptance**: tick holds 30 Hz ±1% over a 5-minute soak with 16 simulated entities; overrun ticks logged, never skipped silently.
  - **Test**: unit test with fake timers asserting tick cadence + drift correction; soak script in `game-server/tests/tick-soak.test.ts`.
- [ ] T003 [P] [INFRA] Binary snapshot protocol shared by server and client: `game-server/src/protocol/schema.ts` + mirrored `src/lib/combined-arms/protocol/schema.ts` — bit-packed ArrayBuffers (positions quantized to 1 cm ints, view angles 16-bit, velocities half-float), delta compression against per-client acked baselines (NFR-001, PRD A.3). No JSON on the hot path.
  - **Acceptance**: encode→decode round-trip is lossless within quantization tolerance; delta against a baseline is strictly smaller than a keyframe.
  - **Test**: property-based round-trip tests in `game-server/tests/protocol.test.ts` (fast-check or equivalent).
- [ ] T004 [INFRA] Server transport layer in `game-server/src/transport/`: WebTransport (QUIC) endpoint with the datagram/stream split — unreliable datagrams for per-tick input/snapshots, reliable streams for must-arrive events (kills, capture changes, tickets, squad membership) — plus a WebSocket endpoint that speaks the identical protocol (NFR-005, PRD A.1). DEPENDS: T001, T003.
  - **Acceptance**: a test client connects over both transports and receives identical snapshot payloads; datagram loss does not stall the reliable stream.
  - **Test**: integration test with an induced 5% datagram drop asserting stream events still arrive in order.
- [ ] T005 [INFRA] Client transport in `src/lib/combined-arms/net/transport.ts`: WebTransport primary, automatic WebSocket fallback (pre-26.4 Safari, UDP-hostile networks), connection-state machine surfaced to the UI. DEPENDS: T003, T004.
  - **Acceptance**: with WebTransport unavailable (feature-detect stubbed), the client silently falls back to WS and plays; fallback flagged in the debug overlay.
  - **Test**: unit tests for the fallback state machine; Playwright smoke with WebTransport disabled via init script.
- [ ] T006 [US1] Client-side prediction + reconciliation for one local capsule in `src/lib/combined-arms/sim/prediction.ts`: input sequence numbers, immediate local simulation, rewind-and-replay on authoritative snapshot, mispredictions smoothed over ~100 ms — never snapped (NFR-003, PRD A.2). DEPENDS: T002, T005.
  - **Acceptance**: at 100 ms simulated RTT, local movement responds within one frame; forced misprediction corrects without a visible snap.
  - **Test**: deterministic sim unit test — replay a scripted input log against a scripted snapshot log, assert final position + max per-frame correction delta.
- [ ] T007 [US1] Snapshot interpolation for remote capsules in `src/lib/combined-arms/sim/interpolation.ts`: 100 ms buffer, interpolate between the two most recent snapshots, extrapolation clamp on buffer underrun (NFR-003). DEPENDS: T003.
  - **Acceptance**: remote capsules move smoothly at 30 Hz snapshots with 10% simulated jitter; underrun degrades to a clamp, not a teleport.
  - **Test**: unit test feeding jittered snapshot timings, asserting continuous interpolated positions.
- [ ] T008 [US1] Lag-compensated hitscan in `game-server/src/sim/lagcomp.ts`: per-tick position history ring buffer, rewind all hittable entities to the shooter's interpolation timestamp, test hit, restore — rewind capped at 250 ms (NFR-004). Projectiles are forward-simulated, no rewind. DEPENDS: T002.
  - **Acceptance**: a shot from a 200 ms-RTT client at a moving target's on-screen position registers; a 400 ms-stale claim is clamped to the 250 ms cap and misses.
  - **Test**: unit tests for rewind math + the cap boundary in `game-server/tests/lagcomp.test.ts`.
- [ ] T009 [US1] Graybox spike route at `src/app/game/combined-arms/page.tsx`: `'use client'` + `dynamic(() => import(...), { ssr: false, loading: () => <Loader /> })` per the 047 `/game/3d` precedent (047 T014); R3F shell renders 16 capsules on a flat graybox plane, WASD + mouse-look, hitscan fire, hit markers. Sim loop in `src/lib/combined-arms/sim/` outside React (NFR-006). DEPENDS: T006, T007, T008.
  - **Acceptance**: 16 capsules (1 local + 15 server-driven) move and shoot in-browser against the Docker match server; static export emits `out/game/combined-arms/index.html`.
  - **Test**: Playwright spec `tests/e2e/combined-arms/spike.spec.ts` — route mounts canvas, connects, receives snapshots, no console errors.
- [ ] T010 [P] [INFRA] Bandwidth + latency instrumentation: per-client downstream KB/s meter server-side (`game-server/src/metrics.ts`) and a client debug overlay (`src/lib/combined-arms/net/stats.ts`) showing RTT, snapshot rate, KB/s down, prediction-error magnitude. DEPENDS: T004.
  - **Acceptance**: overlay and server logs agree on KB/s within 5%; numbers exportable as JSON for the T012 report.
  - **Test**: integration test asserting the meter counts bytes actually written to the transport.
- [ ] T011 [P] [INFRA] Network-condition harness in `game-server/tests/netsim/`: artificial delay/jitter/loss injection at the transport seam (or toxiproxy sidecar in `docker-compose.yml`) so 100 ms RTT + jitter + loss are reproducible in CI and local playtests. DEPENDS: T004.
  - **Acceptance**: harness imposes a configured 100 ms RTT ±10 ms measured end-to-end.
  - **Test**: self-test asserting the imposed RTT is within tolerance.
- [ ] T012 [INFRA] **KILL-CRITERION EVALUATION (Phase 0 exit gate)**: run the 16-capsule graybox at 100 ms simulated RTT (via T011) with all 16 capsules moving and shooting; record perceived-latency verdict (structured playtest rubric: input response, misprediction visibility, hit registration trust) and measured downstream bandwidth. **PASS = perceived latency acceptable at 100 ms RTT AND ≤20 KB/s down per client. If NOT: STOP — no Phase 1 ticket starts; re-evaluate platform choice (Rust server, transport changes, or abandon browser-native) before any further build-out** (PRD §7 Phase 0; spec Assumptions). DEPENDS: T009, T010, T011.
  - **Acceptance**: written evaluation committed to `features/enhancements/048-combined-arms/phase0-verdict.md` with bandwidth JSON attached; explicit GO / NO-GO.
  - **Test**: the evaluation itself; bandwidth number reproduced by CI netsim run.

**Checkpoint**: Phase 0 verdict recorded. GO unlocks Phase 1; NO-GO stops the feature at ~12 tickets spent.

---

## Phase 1 — Vertical Slice (PRD §7 Phase 1: one map, 4 classes, full Conquest loop, squads, bots)

**Goal**: a bot-filled 16v16 match on the real north-shore map with capture, atomic spawn flips, tickets, bleed, squad-leader spawn, and combat denial. US1 + US2 fully playable.

**⚠️ GATE**: every ticket below DEPENDS on T012 = GO.

- [ ] T013 [P] [US1] Bake the MVP map source: author `sites/north-shore.json` (Coolidge Park / Frazier Ave, ~600×600 m box) and run `docker compose exec scripthammer pnpm bake` reusing the #232 parameterized-bake + #229 lidar-heights pipeline; commit the site config + baked artifacts. Add explicit `!` allowlist entries to `.gitignore` for `sites/north-shore.json` + `public/twins/north-shore/` (repo privacy default gitignores `sites/*` — this public-parkland site is deliberately allowlisted like chatt).
  - **Acceptance**: bake produces `terrain.json` + streets/buildings for the box; artifacts committed and visible to CI (CI builds the committed tree — no local-only data).
  - **Test**: rebake verifies semantically (manifest modulo fetchedAt/site, drape byte-identity per repo bake lessons); `git check-ignore` confirms the allowlist.
- [ ] T014 [US1] Terrain adapter in `src/lib/combined-arms/map/heightmap.ts` + `game-server/src/map/heightmap.ts`: convert baked `terrain.json` into the shared game-resolution heightmap (identical sampling on both sides — server is authoritative for ground truth); baked streets/buildings parsed into cover-primitive placements per Appendix C graybox rules (~40 cover primitives per lane, crouch + stand heights, two elevation changes per lane). DEPENDS: T013.
  - **Acceptance**: client and server sample identical heights for 1,000 random points (bit-exact); cover set renders in graybox.
  - **Test**: cross-checked height-sampling unit test shared by both packages.
- [ ] T015 [US1] CP + spawn layout config in `game-server/src/map/north-shore-layout.ts`: five capture volumes over the real geography per spec FR-005 — A = Coolidge Park carousel lawn, B = Walnut St Bridge north landing, C = elevated hill-climb block (18 m radius, hardest hold), D = Frazier Ave strip, E = Renaissance Park knoll (20–30 m radii per CQ-2); uncapturable NW/SE home bases with main-protection zones; spawn clusters 4–6 points per CP, facing cover, ≥8 m from the flagpole (Appendix C). DEPENDS: T014.
  - **Acceptance**: layout loads on the server; adjacent-CP foot-travel time measures 25–35 s sprint in-engine (Appendix C target).
  - **Test**: layout-invariant unit tests (radii bounds, spawn-point distances, base-corner positions) + a scripted travel-time integration test.
- [ ] T016 [P] [US1] Capture-meter math as a UNIT-TESTED executable spec in `game-server/src/sim/capture.ts`: −100…+100 meter, **6.25 pts/s base** (neutralize 16 s, full flip 32 s solo), headcount multipliers **1.0×/1.5×/2.0× at 1/2/3+ net players (capped at 3)**, **contested freeze** when both teams in radius, **2 pts/s decay** toward the owner's state when attackers leave, and two-stage neutralize-then-capture (enemy flag must cross 0 before capturing) — every number from Appendix B.1 asserted (CQ-2). DEPENDS: T012 only (pure math, map-independent).
  - **Acceptance**: table-driven tests reproduce the Appendix B.1 table exactly (32 s / ~21 s / 16 s full-flip times) plus freeze, decay, and neutralize-first transitions.
  - **Test**: `game-server/tests/capture.test.ts` — the tuning table IS the test fixture.
- [ ] T017 [US1] Wire capture volumes to the tick loop in `game-server/src/sim/capture-system.ts`: per-tick radius occupancy → meter updates via T016, CP owner-state machine (enemy → neutral → friendly), meter state replicated in snapshots for HUD widgets. DEPENDS: T015, T016.
  - **Acceptance**: US1 acceptance scenarios 1–2 pass in a bot match (solo neutralize in 16 s; contested freeze).
  - **Test**: server integration test scripting bot occupancy against the live tick loop.
- [ ] T018 [P] [US1] Ticket pool + bleed in `game-server/src/sim/tickets.ts`: 300 start (16v16), respawn −1 (revive −0 hook for Phase 2), majority bleed 1 ticket/5 s at ≤2 of 5 CPs, total-control bleed 1 ticket/2 s at zero CPs, first to 0 loses, same-tick tie broken by pre-drain tickets then CP count (CQ-4; spec Edge Cases). Include the **Appendix B.3 20-minute sanity simulation as a test**: 16v16, death every 75 s/player, 25% revive rate, behind-on-flags half the match → losing team hits 0 at ≈20 min.
  - **Acceptance**: sanity sim lands match end at 20 min ±10%; all drain sources sum per B.3 (≈192 spawn + ≈120 bleed).
  - **Test**: `game-server/tests/ticket-sim.test.ts` runs the B.3 scenario headless.
- [ ] T019 [US1] **Atomic spawn-flip event** in `game-server/src/sim/spawn-flip.ts`: when a CP crosses to fully captured at tick T, emit exactly one `{cpId, newOwner, tick}` event **on the reliable stream** and invalidate all queued spawns on that CP **in the same tick** — no client may complete a spawn at the lost flag after T; simultaneous-crossing contention resolved by authoritative tick order, exactly one event (CQ-3, Appendix B.4, spec Edge Cases). DEPENDS: T004, T017.
  - **Acceptance**: US1 acceptance scenario 3 passes — flip event observed on the reliable stream, queued spawn invalidated same tick, zero post-T spawns at the lost flag across 100 scripted flips.
  - **Test**: server integration test racing a queued spawn against the flip tick; fuzz both-teams-crossing contention.
- [ ] T020 [US1] Client flip UX: `src/components/combined-arms/SpawnFlipBanner/` (5-file pattern via `pnpm run generate:component`) — map flash on the deploy map, audio sting, kill-feed-style banner; mid-countdown spawners bounced back to spawn selection (CQ-3; wireframe 01 + 03 anchors). DEPENDS: T019, T021.
  - **Acceptance**: US1 acceptance scenario 4 passes — flip lands within one RTT as icon swap + flash + sting + banner; bounced player returns to selection.
  - **Test**: component unit + a11y tests; Playwright spec asserting the bounce on a scripted flip.
- [ ] T021 [US1] Deploy screen per **wireframe 01-deploy-screen.svg**: `src/components/combined-arms/DeployScreen/`, `DeployMap/`, `ClassPicker/` (each 5-file pattern) — top-down map with owned-CP spawn markers, squad-leader spawn icon, combat-denial state region (both flag variants), spawn-wave timer slot (cadence itself lands T036), class picker; 44 px touch targets (CQ-5). DEPENDS: T015 (CP data shape), T012.
  - **Acceptance**: deploy screen renders live CP ownership; selecting an owned CP + class queues a spawn; matches signed-off wireframe 01.
  - **Test**: component unit + a11y + Storybook per 5-file pattern; Playwright deploy-flow spec.
- [ ] T022 [US2] Squad lifecycle in `game-server/src/sim/squads.ts`: create (creator becomes leader) / join open squad (cap 6) / leave; lone-wolf state (controlled-flag spawns only); leader succession — auto-pass to longest-tenured on leave, manual hand-off; membership changes on the reliable stream (SQ-1, SQ-3). Client squad menu `src/components/combined-arms/SquadMenu/` (one-key open, SQ-6). DEPENDS: T012.
  - **Acceptance**: US2 acceptance scenarios 1 + 5 pass — create/join/leave/lone-wolf paths + succession to longest-tenured with a live denial clock not transferring (spec Edge Cases).
  - **Test**: server unit tests for succession ordering; Playwright two-client squad-menu spec.
- [ ] T023 [US2] Squad-leader spawn + **SQ-4 combat denial** in `game-server/src/sim/leader-spawn.ts`: spawn 1–3 m behind leader facing with 1.5 s spawn-protection shimmer (ends early on firing/aggressive movement — protected players cannot deal damage while immune); leader spawn denied while leader dead; denied for **8 s after leader takes damage**; **both denial-state presentations (visible countdown vs opaque) behind a server flag** `denialTimerVisible`, instrumented for playtest comparison (SQ-2/SQ-3/SQ-4; Clarifications). DEPENDS: T021, T022.
  - **Acceptance**: US2 acceptance scenarios 2–4 pass under both flag values; shimmer cancels on fire; denial expires at exactly 8 s from last damage.
  - **Test**: server unit tests on the denial clock + placement geometry; Playwright spec toggling the server flag and asserting both deploy-screen states.
- [ ] T024 [P] [US4] Four classes with baseline kits in `game-server/src/sim/classes.ts` + client kit definitions `src/lib/combined-arms/classes.ts`: Assault (rifle + grenades), Medic (heal; revive lands T037), Support (LMG + ammo resupply), Recon (marksman) — BF2-weight movement: sprint + stamina, no slide-cancel, TTK 3–5 body shots (FR-001, FR-003). DEPENDS: T012.
  - **Acceptance**: US4 acceptance scenarios 1 + 4 pass — all four selectable on deploy; stamina-gated sprint; TTK in range on the reference rifle.
  - **Test**: damage-model unit tests (TTK table); stamina curve unit test.
- [ ] T025 [P] [US4] Spotting in `game-server/src/sim/spotting.ts` + `src/components/combined-arms/SpotMarker/`: aim + Q pings the targeted enemy for the player's squad as a 3D marker for 6 s; server validates line-of-sight (FR-002, NFR-007). DEPENDS: T012.
  - **Acceptance**: US4 acceptance scenario 3 passes — marker visible to squad only, expires at 6 s, LoS-gated.
  - **Test**: server LoS unit test; marker-lifetime component test.
- [ ] T026 [US1] Bots in `game-server/src/sim/bots.ts`: fill a 16v16 server — navigate the heightmap, contest/defend CPs, shoot on sight; good enough to exercise the Conquest loop, not to impress (FR-006). DEPENDS: T015, T017.
  - **Acceptance**: a solo player + 31 bots produces a complete match — captures, flips, bleed, and a 0-ticket ending — unattended.
  - **Test**: headless full-match simulation test asserting match reaches a winner within 30 min sim time.
- [ ] T027 [P] [US1] Pa11y coverage: add the COMBINED ARMS menu + deploy routes to `config/pa11yci.json` allowlist; in-match canvas route stays excluded with an inline canvas-not-auditable note (047 T002 precedent). DEPENDS: T021.
  - **Acceptance**: `docker compose exec scripthammer pnpm test:a11y` exit 0 with menu/deploy audited; canvas route documented as excluded.
  - **Test**: the Pa11y run itself + config review.
- [ ] T028 [US1] **Phase 1 slice checkpoint**: bot-filled 16v16 on north-shore end-to-end — capture CP B, verify the US1 Independent Test ((a) meter rates, (b) deploy-screen flip within one RTT on all clients, (c) ticket drain + bleed per the tuning table, (d) 0 tickets = loss), plus US2 Independent Test (leader spawn + 8 s denial, both flag variants). DEPENDS: T017–T027.
  - **Acceptance**: both Independent Tests pass live; recorded as the Phase 1 exit note in this file.
  - **Test**: scripted Playwright multi-client run + manual playtest sign-off.

**Checkpoint**: US1 + US2 shippable as a lonely-but-real game (spec US1 rationale). Phase 2 unlocked.

---

## Phase 2 — The Social Layer (PRD §7 Phase 2: voice, orders, waves, revives)

**Goal**: the game becomes _the game_ — squad voice + command net, orders with score bonuses, spawn waves, medic revive. US3 + US4 complete.

- [ ] T029 [US3] Voice SFU infrastructure: LiveKit (self-hosted, Apache 2.0) service in `docker/livekit/` + `docker-compose.yml` entry for dev; room provisioning from the match server (`game-server/src/voice/rooms.ts`) — room per squad created on squad create, torn down aggressively on disband/idle; **JWT tokens scoped to match + squad ID** minted server-side so a client can never join another squad's channel (VC-3, NFR-008, PRD A.4). DEPENDS: T022 (squad lifecycle events).
  - **Acceptance**: US3 acceptance scenario 4 passes — a squad-X token is rejected for squad Y's room and for any other match's rooms; idle rooms torn down within 60 s.
  - **Test**: token-scoping integration test against a live dev SFU; teardown timer unit test.
- [ ] T030 [US3] Squad voice client per **wireframe 02-squad-hud.svg**: auto-join squad channel on squad join with zero configuration, PTT default + open-mic option + per-player mute (`src/lib/combined-arms/voice/client.ts`); speaking indicators on the squad roster and name-flash above teammate heads — `src/components/combined-arms/SquadRoster/` + `VoiceIndicator/` (5-file pattern; roster shows names, health, alive/dead, class icon, leader star per SQ-6) (VC-1, VC-4). Match plays on if the SFU is unreachable — roster shows channel-unavailable + background reconnect (spec Edge Cases). DEPENDS: T029.
  - **Acceptance**: US3 acceptance scenarios 1–2 pass; SFU-down degrades gracefully without blocking the match.
  - **Test**: two-client Playwright voice-join spec (mock media); roster component unit + a11y tests; SFU-unreachable fault-injection test.
- [ ] T031 [US3] Command channel: second PTT key routes leader audio to the all-leaders channel (not their own squad); command-room provisioning + leader-scoped token claim in `game-server/src/voice/rooms.ts` (VC-2). DEPENDS: T030.
  - **Acceptance**: US3 acceptance scenario 3 passes — leader-only, reaches all leaders, absent from the squad channel; non-leaders hold no command claim.
  - **Test**: token-claim integration test + two-squad routing test.
- [ ] T032 [US3] Voice moderation baseline (launch requirement for the voice phase, NOT a fast-follow — NFR-008): leader voice-kick from squad channel, server-level mute list persisted across matches, report flow feeding the moderation queue (`game-server/src/voice/moderation.ts` + report UI in `src/components/combined-arms/ReportDialog/`) (VC-5). DEPENDS: T030.
  - **Acceptance**: US3 acceptance scenario 5 passes — kick removes channel access immediately; muted player stays muted in their next match; report lands in the queue.
  - **Test**: moderation-flow integration tests; mute-list persistence test.
- [ ] T033 [P] [US2] Squad orders in `game-server/src/sim/orders.ts` + `src/components/combined-arms/OrderMarker/`: leader places Attack/Defend/Move via map marker or 3D world ping, visible to the squad (roster + world + deploy map); passive score bonuses for acting on orders — spawn-on-leader, capture near marker, kill near marker (SQ-5). DEPENDS: T022; marker rendering shares wireframe 02 chrome (T030).
  - **Acceptance**: order placement replicates to all squad members; each bonus source scores per the tuning constants.
  - **Test**: score-attribution unit tests (three bonus paths); marker replication integration test.
- [ ] T034 [P] [US1] Spawn waves in `game-server/src/sim/spawn-waves.ts`: 10 s cadence so squads re-enter together; deploy screen's wave timer (slot built in T021) driven live (CQ-5). DEPENDS: T021.
  - **Acceptance**: all spawns queued within a wave window materialize on the same tick; deploy screen counts down to the actual wave tick.
  - **Test**: server wave-batching unit test; Playwright timer-accuracy spec.
- [ ] T035 [US4] Medic revive in `game-server/src/sim/revive.ts`: downed state with **10 s bleed-out window**, Medic revive returns the player to play with **zero ticket cost** (wired to T018's revive hook); window lapse or give-up → normal respawn at 1 ticket (FR-001, CQ-4, Appendix B.2). DEPENDS: T018, T024.
  - **Acceptance**: US4 acceptance scenario 2 passes — revive drains zero tickets; lapse/give-up drains exactly 1 on respawn.
  - **Test**: ticket-ledger unit test around the downed-state machine; re-run the T018 sanity sim with the 25% revive rate now real.

**Checkpoint**: US3 + US4 complete; SC-001/SC-002/SC-003 (spawn/squad/voice participation) become measurable. Phase 3 unlocked.

---

## Phase 3 — Breadth (PRD §7 Phase 3: 32v32, transport, scoreboard, playtest ops)

**Goal**: product-target scale (32v32), the vehicle-netcode proof, match legibility, and the instrumentation + admin surface playtests need. US5 complete.

- [ ] T036 [US5] Interest management + priority accumulator in `game-server/src/sim/interest.ts`: ~50 m grid partition (full rate ≤150 m/on-screen, 10 Hz mid-range, position-only heartbeat for distant squadmates/spotted targets — map icons still need them); per-entity priority accrual (proximity, visibility, recent damage) packing each snapshot to the byte budget so load degrades gracefully instead of stuttering (NFR-001, PRD A.3). DEPENDS: T012 (extends the T003/T004 pipeline); MUST NOT regress 16v16 numbers.
  - **Acceptance**: 64-entity synthetic load stays ≤40 KB/s down per client; squadmate/spotted map icons never starve.
  - **Test**: netsim load test (T011 harness) asserting budget + starvation-freedom; 16v16 regression run at ≤20 KB/s.
- [ ] T037 [US5] **32v32 load validation**: 64 bot-or-scripted clients on north-shore under the T011 harness — server holds 30 Hz, per-client downstream ≤40 KB/s, no design regression from 16v16 (NFR-001, NFR-002, NFR-009; US5 acceptance scenario 3). DEPENDS: T026, T036.
  - **Acceptance**: 20-minute 64-player soak: tick ≥29.7 Hz throughout, p95 client bandwidth ≤40 KB/s, results committed alongside the Phase 0 verdict.
  - **Test**: the soak run itself, wired as a repeatable `game-server/tests/load/` script.
- [ ] T038 [US5] Transport truck in `game-server/src/sim/vehicles.ts` + client model in `src/lib/combined-arms/sim/vehicle.ts`: one open-top 4-seat truck (one driver + 3 passengers, distinct seats), spawned at home bases at round start; vehicle replication under the same prediction/interpolation regime as infantry — this IS the vehicle-netcode proof (FR-004; US5 scenarios 1–2). DEPENDS: T014 (terrain), T006/T007 (prediction/interp).
  - **Acceptance**: 4 players mount/dismount cleanly; base→far-lane drive ≈35 s vs ≈90 s on foot (Appendix C travel targets).
  - **Test**: seat-assignment unit tests; scripted drive-time integration test; two-client replication smoothness spec.
- [ ] T039 [P] [US1] Scoreboard overlay per **wireframe 03-scoreboard-tickets.svg**: `src/components/combined-arms/Scoreboard/` (5-file pattern) — per-team ticket pools, bleed indicator, CP ownership strip, per-squad player grouping (CQ-4 legibility; SC-006 visibility). DEPENDS: T018, T022.
  - **Acceptance**: overlay matches signed-off wireframe 03 and tracks live ticket/bleed/CP state within one snapshot.
  - **Test**: component unit + a11y tests; Playwright overlay-vs-server-state consistency spec.
- [ ] T040 [P] [US1] Playtest instrumentation in `game-server/src/metrics/playtest.ts`: per-match capture of death heatmaps, per-CP flip counts, squad-spawn locations, and time-to-first-contact from each spawn cluster (SC-011); emits the SQ-4 flag-variant comparison stream (T023). **Map-lattice success criteria: B and D flip 3–4× as often as A and E (SC-009); C changes hands most of all (SC-010).** DEPENDS: T017, T023.
  - **Acceptance**: every playtest match writes a structured metrics artifact containing all four instruments + the SQ-4 variant tag.
  - **Test**: schema-validation unit test on the artifact; replayed bot match produces non-empty heatmap + flip counts.
- [ ] T041 [US1] §8 metrics dashboards over the T040 stream: SC-001 (≥50% leader spawns), SC-002 (≥70% squad participation), SC-003 (voice usage), SC-004 (15–25 min median), SC-005 (15–30% comeback), SC-006 (winner ≤40% tickets), SC-007 (≥8 flips/match), SC-008 (session/retention) — plus the B.3 tuning-lever guidance (bleed interval first, start pool second, respawn cost last) linked next to the SC-005 gauge. DEPENDS: T040.
  - **Acceptance**: each SC-001…SC-008 metric computable from real match artifacts and rendered with its target band.
  - **Test**: dashboard-query unit tests against a fixture set of synthetic matches with known aggregates.
- [ ] T042 [P] [INFRA] Community-server admin tools: kick/ban in `game-server/src/admin/` (authenticated admin channel, persisted ban list, in-match kick) — the social immune system, cheap and load-bearing (NFR-007, PRD A.5). DEPENDS: T012.
  - **Acceptance**: admin kick removes a live client within one tick; banned identity cannot rejoin that server.
  - **Test**: admin-flow integration tests including ban persistence across match restart.
- [ ] T043 [P] [INFRA] Statistical anomaly review queue in `game-server/src/anticheat/`: server-side sanity checks (speed caps, RoF caps, impossible-angle detection) + statistical outlier flagging (headshot %, reaction-time distributions) feeding a human review queue — flags, never auto-bans (NFR-007, PRD A.5). DEPENDS: T008 (hit pipeline), T040 (metrics plumbing).
  - **Acceptance**: a scripted speed-hack and an impossible-RoF bot both land in the queue with evidence attached; clean bots produce zero flags over a full match.
  - **Test**: red-team fixture bots asserted flagged; false-positive rate test on clean-match fixtures.

**Checkpoint**: US5 complete; 32v32 validated; playtest program (SC-009/SC-010/SC-011 + SQ-4 decision) fully instrumented.

---

## Dependencies & execution order

```
PHASE 0 (kill-criterion gate)
T001 ──► T002 ──► T004 ──► T005 ──► T006 ─┐
T003 [P] ─┴──────┬─────────► T007 ────────┼─► T009 ─┐
T002 ────────────► T008 ──────────────────┘         ├─► T012 ◄── GO / NO-GO GATE
T004 ──► T010 [P] ──────────────────────────────────┤
T004 ──► T011 [P] ──────────────────────────────────┘

PHASE 1 (all DEPEND on T012=GO)
T013 ──► T014 ──► T015 ──► T017 ──► T019 ──► T020 ──► ┐
T016 [P] ─┘ (pure math)      T021 ──► T023 ◄── T022   ├─► T028 (slice checkpoint)
T018 [P] ────────────────────────────────────────────►│
T024 [P] · T025 [P] · T026 · T027 [P] ───────────────►┘

PHASE 2                              PHASE 3
T022 ──► T029 ──► T030 ──► T031      T036 ──► T037 (needs T026 bots)
T030 ──► T032                        T014+T006/T007 ──► T038
T022 ──► T033 [P]                    T018+T022 ──► T039 [P]
T021 ──► T034 [P]                    T017+T023 ──► T040 [P] ──► T041
T018+T024 ──► T035                   T012 ──► T042 [P] · T008+T040 ──► T043 [P]
```

### Cross-phase DEPENDS summary

- **T012 gates everything**: no Phase 1/2/3 ticket starts on NO-GO (PRD §7 kill criterion).
- **T018 → T035**: the revive hook is stubbed in Phase 1 tickets math, made real by Phase 2 medic revive; the B.3 sanity sim re-runs after T035.
- **T022 → T029/T033**: voice rooms and orders both hang off squad-lifecycle events.
- **T023 → T040**: the SQ-4 visible-vs-opaque decision (Clarifications) is resolved only by T040's instrumented comparison — do not remove the server flag before then.
- **T026 → T037**: bots are the 64-client load source.
- **T036 MUST NOT regress T012's numbers**: interest management is validated against both the 16v16 (≤20 KB/s) and 32v32 (≤40 KB/s) budgets.

## Parallel opportunities

- **Phase 0**: T003 with T001/T002; T010 + T011 side by side once T004 lands.
- **Phase 1**: T013 (bake), T016 (pure capture math), T018 (ticket math), T024 (classes), T025 (spotting) are mutually independent files — five tracks after T012.
- **Phase 2**: T033 + T034 run beside the voice track (T029–T032).
- **Phase 3**: T039 + T040 + T042 + T043 are four independent tracks around the T036→T037 spine.

## Implementation strategy

**Spike first, cheaply killable**: Phase 0 is ~12 tickets and produces a committed GO/NO-GO verdict (`phase0-verdict.md`) before the expensive map/gameplay work begins. **Vertical slice = MVP**: T028 is the first externally playable build (US1 + US2). **Social layer makes it the game** (US3 + US4). **Breadth proves scale** (US5 + playtest ops). Suggested commit pattern: one commit per ticket or tight ticket pair; PR per phase checkpoint (T012, T028, T035, T043).

## Requirement → ticket traceability

| Requirement                             | Tickets                                      | Requirement                                 | Tickets                                                                   |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| SQ-1 (squads/lone wolf)                 | T022                                         | CQ-5 (deploy screen + waves)                | T021, T034                                                                |
| SQ-2 (leader spawn + shimmer)           | T023                                         | CQ-6 (CTF secondary)                        | out of ticket scope — planned Phase 3+ follow-on, explicitly not flagship |
| SQ-3 (succession, leader-death)         | T022, T023                                   | FR-001 (classes + revive)                   | T024, T035                                                                |
| SQ-4 (8 s combat denial, both variants) | T023, T040                                   | FR-002 (spotting)                           | T025                                                                      |
| SQ-5 (orders + bonuses)                 | T033                                         | FR-003 (movement/TTK)                       | T024                                                                      |
| SQ-6 (roster + one-key menu)            | T022, T030                                   | FR-004 (transport truck)                    | T038                                                                      |
| VC-1 (auto-join, PTT)                   | T030                                         | FR-005 (north-shore map)                    | T013, T014, T015                                                          |
| VC-2 (command channel)                  | T031                                         | FR-006 (bots)                               | T026                                                                      |
| VC-3 (SFU + JWT scoping)                | T029                                         | NFR-001 (bandwidth)                         | T003, T010, T012, T036, T037                                              |
| VC-4 (speaking indicators)              | T030                                         | NFR-002 (30 Hz tick)                        | T002, T037                                                                |
| VC-5 (moderation baseline)              | T032                                         | NFR-003 (prediction/interp)                 | T006, T007                                                                |
| VC-6 (no proximity voice)               | excluded — Out of Scope, no ticket by design | NFR-004 (250 ms rewind cap)                 | T008                                                                      |
| CQ-1 (5 CPs + home bases)               | T015                                         | NFR-005 (WT + WS fallback)                  | T004, T005                                                                |
| CQ-2 (capture meter math)               | T016, T017                                   | NFR-006 (browser client, sim outside React) | T009                                                                      |
| CQ-3 (atomic flip + UX)                 | T019, T020                                   | NFR-007 (anti-cheat posture)                | T042, T043                                                                |
| CQ-4 (tickets + bleed)                  | T018, T035, T039                             | NFR-008 (voice security/ops)                | T029, T032                                                                |
| SC-001…SC-008 (§8 metrics)              | T040, T041                                   | NFR-009 (64-player headroom)                | T036, T037                                                                |
| SC-009/SC-010 (lattice flip ratios)     | T040                                         | SC-011 (playtest instruments)               | T040                                                                      |

## Format validation

All tasks follow `- [ ] T### [P?] [Story] description` with exact file paths, one-line acceptance criterion, and a test-strategy note. ✅

- 43 tickets total: Phase 0 = 12 (T001–T012), Phase 1 = 16 (T013–T028), Phase 2 = 7 (T029–T035), Phase 3 = 8 (T036–T043)
- 15 [P]-marked parallel opportunities
- Story coverage: US1 (Conquest loop), US2 (leader spawn), US3 (voice), US4 (classes/revive), US5 (transport/scale) all ticketed; every SQ/VC/CQ/FR/NFR/SC requirement traceable to ≥1 ticket
- Kill criterion (T012) explicitly gates Phases 1–3; static-export constraint respected (game server is a separate `game-server/` deployable; zero Next.js API routes)
