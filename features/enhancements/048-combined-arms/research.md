# Phase 0 Research: COMBINED ARMS

**Feature**: 048 — COMBINED ARMS
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Date**: 2026-07-09

Eight technical decisions resolved with rationale + alternatives. The PRD (`combined-arms-prd.md`, Appendices A–C) already did the deep research; this ledger records what the plan adopts, why, and what was rejected. No `NEEDS CLARIFICATION` markers remain in the spec.

---

## Decision 1: Transport — WebTransport primary, WebSocket fallback

**Decision**: WebTransport (QUIC) as the primary transport: unreliable datagrams for per-tick state (inputs up, snapshots down), reliable streams multiplexed on the same connection for must-arrive events (kill confirms, the B.4 `{cpId, newOwner, tick}` flip, tickets, squad membership, chat). WebSocket fallback retained permanently.

**Rationale**:

- **WebTransport reached Baseline in early 2026.** Safari 26.4 (March 2026) was the last major holdout, joining Chrome 97+, Edge 98+, Firefox 114+ (PRD A.1). The historical objection to a browser-native FPS — iOS/macOS stuck on TCP — is gone.
- **Datagrams are the correct semantics for movement state**: stale packets are dropped, never queued. TCP WebSockets get exactly this wrong (head-of-line blocking — one lost packet stalls everything behind it).
- **Reliable streams on the same connection solve the B.4 problem for free**: the atomic `{cpId, newOwner, tick}` flip, kill confirms, and squad membership must arrive exactly once and in order — QUIC streams give that without a second socket or an ack layer bolted onto datagrams.
- **The fallback is still necessary**, not vestigial: pre-26.4 Safari installs linger, and some corporate/school firewalls block UDP outright. WebTransport itself can also fall back to HTTP/2 with the same API when QUIC is blocked. Fallback clients get a degraded-but-playable experience; the server treats them identically — they just eat more latency variance (spec edge case). The transport layer is therefore an interface with two implementations from day one, which also keeps the Phase 0 spike honest about the worst case.

**Alternatives considered**:

| Alternative         | Reason rejected                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebSocket-only      | Head-of-line blocking makes 30 Hz state feeds stutter under any loss; acceptable as fallback, wrong as primary.                                                                                                |
| WebRTC DataChannels | Unordered/unreliable mode exists, but the connection dance (ICE/STUN/signaling) is heavy for client↔server; WebRTC is peer-oriented plumbing bent into a server shape. Kept for voice only, where it belongs. |
| Raw UDP             | Browsers cannot open UDP sockets. Non-starter; listed for completeness.                                                                                                                                        |

---

## Decision 2: Simulation model — authoritative server + client prediction (vs lockstep / P2P)

**Decision**: One authoritative server at a 30 Hz fixed tick owning all truth; clients predict their own movement (sequence-numbered inputs, rewind-and-replay on ack, ~100 ms misprediction smoothing), interpolate remote entities 100 ms in the past, and rely on server-side lag-compensated hitscan capped at 250 ms rewind (PRD A.2).

**Rationale**:

- **Lockstep cannot work at this scale or genre**: it requires every client to wait for every other client's input each tick — 64 players means the slowest connection sets everyone's latency, and a single stall freezes the match. Lockstep suits RTS/fighting games with tiny player counts and deterministic sims, not a 64-player FPS.
- **P2P has no authority**: any peer can lie about position, health, or capture progress, and browser clients are the most hostile client environment there is (Decision 8). The cheat posture collapses without a server that owns truth.
- **Prediction + interpolation + lag comp is the proven canon** (Source engine, BF-era engines, Gambetta's series — spec References). It delivers sub-100 ms perceived latency (NFR-003) on real-world RTTs without trusting the client with anything.
- **The 250 ms rewind cap** bounds how far high-ping players can shoot into the past; projectiles simulate forward with no rewind so leading targets stays the intended skill.

**Alternatives considered**:

| Alternative                   | Reason rejected                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Deterministic lockstep        | Latency = slowest player; a stall freezes 63 others; no late join; wrong genre fit.                    |
| P2P mesh with host migration  | No authority → unbounded cheating; NAT traversal pain; host advantage; migration is a swamp.           |
| Server relay of client claims | "Authoritative" in name only — server must simulate, not forward, or speed/teleport hacks are trivial. |

---

## Decision 3: Voice — LiveKit self-hosted SFU (vs mediasoup, vs mesh WebRTC)

**Decision**: Self-hosted LiveKit as the SFU. The match server provisions rooms on squad create/join via `livekit-server-sdk` and mints per-match JWTs scoped to match + squad ID; idle channels are torn down aggressively. Two tiers: squad channel + command channel on a second PTT key.

**Rationale**:

- **License + ops fit**: Apache-2.0, Go/Pion single-binary SFU, free to self-host, deployable per region alongside match servers (PRD A.4). No per-minute vendor billing at playtest scale.
- **Proven JS SDKs**: `livekit-client` is mature in browsers (and Unity-WebGL SDKs exist — relevant to the ScriptHammer-family Unity track later). Token-based room scoping is first-class, which is exactly the VC-3 security model.
- **SFU beats mesh at squad size**: a 6-person mesh is 5 uplinks per client; an SFU is 1. Command channel membership (all squad leaders) makes mesh strictly worse as team size grows.
- **Room-per-squad + JWT scoping** makes the VC-3 negative test (client with a squad-X token cannot join squad Y or another match) enforceable at the SFU, not in client code.

**Alternatives considered**:

| Alternative        | Reason rejected                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mediasoup          | Excellent SFU library, but it is a Node library, not a deployable — we'd own signaling, scaling, and recording surface area LiveKit already ships. More glue code for the same result. |
| Mesh WebRTC        | O(n²) uplinks; 6-person squad = 5 encodes per speaker; command net makes it worse; mobile upload budgets die.                                                                          |
| Managed SaaS voice | Per-minute pricing scales with exactly the metric we hope grows (voice adoption ≥40% of squads); vendor lock-in; self-host was the PRD default.                                        |

---

## Decision 4: Client simulation — plain TypeScript ECS outside React; R3F for chrome only

**Decision**: The simulation (entities, movement, prediction, interpolation buffers) is a plain-TS ECS in `shared/ecs` + `src/game-client/`, ticked by its own fixed-timestep accumulator. R3F renders menus, deploy screen, and HUD chrome as 5-file components; the in-match canvas mounts once and hands its render loop to the sim. HUD chrome reads sim state through a snapshot store throttled to ≤10 Hz.

**Rationale**:

- **React's reconciler is the wrong tool at entity counts**: 64 players + projectiles + vehicles at 30–120 Hz through props/state means thousands of reconciliation passes per second — GC pressure and frame spikes exactly where NFR-003 forbids them. R3F's own docs steer per-frame work into `useFrame` refs for this reason; we go one step further and keep per-frame state out of React entirely.
- **The repo already proved this pattern**: `src/stage/StageCore.tsx` owns an authoritative render loop via `useFrame(..., 1)` — its comment reads "renderPriority 1 suppresses R3F's own render; this loop is authoritative." The digital-twin stage renders terrain, water, and buildings on its own loop while React handles only composition. COMBINED ARMS generalizes that: one `<CombatCanvas>` mount, sim-owned loop, React never in the hot path.
- **R3F stays where it earns its keep**: DaisyUI-themed menus, deploy screen, roster, scoreboard — low-frequency, accessibility-auditable DOM/chrome where the 5-file pattern and Pa11y apply (Constitution I, and the 047 theming precedents carry over directly).

**Alternatives considered**:

| Alternative                          | Reason rejected                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everything in R3F components         | Per-frame reconciliation at 64+ entities; GC churn; fights prediction rollback (replaying inputs must not re-render React).                                                        |
| No React at all (raw canvas page)    | Throws away the 5-file/DaisyUI/Pa11y machinery for menus and HUD chrome that the constitution requires anyway.                                                                     |
| Off-the-shelf ECS (bitecs, miniplex) | Viable — but the protocol wants SoA typed arrays shaped exactly like the wire format; a hand-rolled store is ~300 LOC and keeps client/server byte-identical. Revisit if it grows. |

---

## Decision 5: Server language — Node/TS one-match-per-process; Rust only if profiling demands

**Decision**: The match server is Node 22/TypeScript, one match per containerized process. Rust is the escape hatch **only** if profiling at 64 players shows Node cannot hold the 30 Hz tick (PRD A.4).

**Rationale**:

- **Shared code is the killer feature**: client prediction is only honest when client and server run byte-identical movement/rules code — `shared/` compiles into both. A Rust server forfeits that or forces WASM contortions on day one.
- **One match per process** makes the failure domain one match, scaling = scheduling containers, and profiling trivially attributable. Node is demonstrably viable at 32 players for tick-loop workloads that avoid GC churn (preallocated typed arrays, no per-tick allocation — the protocol design already requires this discipline).
- **The kill criterion protects us**: PRD Phase 0 measures perceived latency with real prediction under simulated RTT before anything else is built. If Node is the bottleneck, we learn it in weeks 1–6, not after the vertical slice.

**Alternatives considered**:

| Alternative          | Reason rejected                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Rust from day one    | Splits the sim codebase or forces WASM sharing; slows every Phase 0–1 iteration; solves a problem profiling hasn't shown yet. |
| Go                   | Same shared-code forfeit as Rust without Rust's ceiling; no in-house precedent.                                               |
| Multi-match monolith | One GC pause or crash hits every match on the box; complicates AoI memory locality; against PRD A.4.                          |

---

## Decision 6: Map source — the digital-twin bake (`sites/north-shore.json`)

**Decision**: The MVP map derives from the existing #232 parameterized bake pipeline: a new committed `sites/north-shore.json` (Coolidge Park / Frazier Ave, ~600×600 m) produces `terrain.json` (server + client heightmap), `streets.json`/`buildings.json` with #229 lidar heights (cover primitives + CP capture volumes authored over real intersections), and `drape.jpg` for authoring orientation only. The shipped graybox is untextured per Appendix C.

**Rationale**:

- **Free, already-verified accuracy**: the pipeline's georegistration was proven to ~5 m against TDOT/lidar ground truth in the #229/#233 accuracy program — terrain and street geometry we'd otherwise hand-author arrives correct.
- **Real geography is the local flavor**: the Appendix C lattice maps cleanly onto the north shore (A=Coolidge carousel lawn … E=Renaissance Park knoll, C=the elevated hill-climb block), and "fight over the Walnut St Bridge landing" beats an abstract graybox for playtest recruitment.
- **Graybox-first still holds**: drape imagery never ships in the game surface — readability at 200 m (Appendix C) demands untextured primitives; the twin supplies where things are, not how they look.
- **Clean-room insurance**: real Chattanooga from open data cannot be mistaken for any BF2 map (spec Clean-Room Note).
- **The one unproven step is scoped**: adapting `terrain.json` to a game-resolution heightmap consumed by both server collision and client rendering is new work (spec Assumptions flags it), but it is a resampling adapter over data the pipeline already emits — plan-level, not research-level, risk. The connect-time terrain checksum (quickstart recipe 3) keeps the two consumers honest.

**Alternatives considered**:

| Alternative                  | Reason rejected                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Hand-authored fictional map  | Duplicates terrain/street authoring the pipeline does for free; loses local identity; still needs a heightmap toolchain.     |
| Ship the drape-textured twin | Violates Appendix C graybox discipline; aerial texture kills silhouette readability; asset licensing questions at ship time. |
| Third-party terrain assets   | Licensing risk, no local flavor, no fidelity guarantee — worse than what we already own.                                     |

---

## Decision 7: Tuning constants — PRD Appendix B adopted verbatim as the initial executable spec

**Decision**: `shared/tuning.ts` encodes Appendix B exactly: capture 6.25 pts/s base on a −100…+100 meter; multipliers 1.0×/1.5×/2.0× at 1/2/3+ net players (capped at 3); decay 2 pts/s toward owner state; 300 tickets/team; respawn cost 1; majority bleed 1 ticket/5 s; total-control bleed 1 ticket/2 s; 10 s revive window (revives cost zero tickets); 10 s spawn waves; 8 s combat denial; 250 ms rewind cap. Vitest specs assert the derived table (solo flip 32 s, 2-player ~21 s, 3+ 16 s) and reproduce the B.3 sanity simulation (~312 tickets drained ≈ 20-minute match).

**Rationale**:

- **The math was already balance-checked** (B.3): death drain + bleed drain lands the 15–25 min median without one system dominating. Inventing new numbers would re-litigate solved work.
- **Constants-as-tests make drift visible**: any future tuning change fails a test and forces a deliberate, recorded decision.
- **These are playtest levers, not gospel** — flagged as such. Tuning order when playtests misbehave (B.3): **bleed interval first** (shapes strategy), **starting pool second** (shapes duration), **respawn cost last** (touches everything). Comeback health check: <15% trailing-at-half wins → weaken bleed; >30% → holding flags isn't rewarding enough.

**Alternatives considered**:

| Alternative                      | Reason rejected                                                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playtest-first, derive constants | Circular — there is nothing to playtest without initial numbers; B.3 already balance-checked these.                                                                    |
| Copy BF2's literal values        | Unknown (never published), and reverse-engineering them is clean-room-adjacent risk for zero gain.                                                                     |
| Server-side live-tunable config  | Deferred, not rejected — constants stay in `shared/tuning.ts` so both sides agree; a hot-reload lever can wrap the same module when playtests demand faster iteration. |

---

## Decision 8: Cheat posture — honest ceiling, server authority, social immune system

**Decision**: Accept that browser clients permit no kernel anti-cheat, ever. Mitigations in PRD A.5's value order: (1) server authority over **everything** — positions, health, ammo, capture progress; (2) server-side sanity checks — speed caps, rate-of-fire caps, impossible-angle detection; (3) statistical outlier flagging (headshot %, reaction-time distributions) feeding a human review queue, never auto-banning; (4) community servers with admin kick/ban as the social immune system.

**Rationale**:

- Wallhacks and aimbots reading the client's own memory are unpreventable in a browser; what the server never sends (AoI culling doubles as anti-wallhack for distant entities) or never trusts, the client cannot exploit beyond its own inputs.
- Statistical flagging feeds humans, not autobans — false positives against skilled players are more corrosive than the cheaters the automation would catch.
- The genuinely load-bearing anti-cheat of the BF2 era was admins with ban buttons — cheap to build, community-forming, and aligned with making **ranked play a non-goal** so the incentive to cheat stays low. Design around the ceiling instead of pretending it isn't there.

**Alternatives considered**:

| Alternative                              | Reason rejected                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Client-side obfuscation/integrity checks | An arms race lost by construction (the attacker owns the runtime); hostile to the open-web posture.                             |
| Third-party anti-cheat SaaS              | Built for native builds with kernel or process access; in a browser it reduces to the sanity checks we already run server-side. |

---

## Open questions

None blocking `/speckit.tasks`. The SQ-4 visible-vs-opaque denial timer is deliberately unresolved — both variants ship behind a server flag and playtest data decides (spec Clarifications). Rust migration and 64-player budget verification are gated behind PRD Phase 0/Phase 3 measurements by design.
