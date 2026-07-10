# Implementation Plan: COMBINED ARMS

**Branch**: `048-combined-arms` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `features/enhancements/048-combined-arms/spec.md`; authoritative PRD at `combined-arms-prd.md` (repo root, Draft v0.1) — §6 Technical Approach, Appendix A (netcode deep-dive), Appendix B (tuning math), Appendix C (graybox lattice).

**Note**: Wireframe gate (Constitution v1.0.2 Principle III) SATISFIED by `wireframes/01-deploy-screen.svg`, `wireframes/02-squad-hud.svg`, and `wireframes/03-scoreboard-tickets.svg`, signed off into spec.md `## UI Mockup`. This file is the cascade's `/speckit.plan` step. PRD delivery phases (0–3) are distinct from the SpecKit plan phases below; they are always prefixed "PRD Phase".

## Summary

A browser-native, squad-centric 32v32 Conquest FPS delivered in four PRD phases. The client is two decoupled layers: a React Three Fiber **shell** for everything that is chrome — main menu, deploy screen, squad menu, HUD roster, scoreboard — built as ScriptHammer 5-file components with DaisyUI theming; and a plain-TypeScript **ECS simulation layer** that owns its own fixed-timestep loop entirely outside React's reconciler (the `src/stage/StageCore.tsx` authoritative-render-loop precedent, generalized). Rendering targets WebGPU with a WebGL2 fallback. The authoritative game server is a separate Node/TS deployable — one match per containerized process at a 30 Hz fixed tick — speaking WebTransport (QUIC datagrams for state, reliable streams for events) with a WebSocket fallback. Voice is a self-hosted LiveKit SFU with per-match JWT-scoped squad and command channels. The MVP map is real North Chattanooga: a new `sites/north-shore.json` baked through the #232 digital-twin pipeline supplies the terrain heightmap and street/building layout that the untextured graybox is authored over.

## Technical Context

**Language/Version**: TypeScript 5 (strict) end-to-end — Next.js 15.5 / React 19 static-export client, Node 22 LTS match server. Rust is a profiling-gated escape hatch only (research.md Decision 5), not a PRD Phase 0–3 dependency.
**Primary Dependencies**:

- Client: `three` + `@react-three/fiber` (already installed via 047); Three.js `WebGPURenderer` with automatic WebGL2 backend fallback; no physics engine — deterministic capsule-vs-heightmap/AABB sweeps in shared code.
- Server: `@fails-components/webtransport` (Node QUIC/WebTransport server), `ws` (fallback), `ioredis` (presence), `livekit-server-sdk` (room provisioning + JWT minting).
- Voice client: `livekit-client`.
- Shared: hand-rolled bit-packed ArrayBuffer protocol (no JSON, no protobuf runtime) per Appendix A.3.

**Storage**: No Supabase schema changes at MVP. Match truth lives in server process memory; Redis holds presence/party; SC-011 playtest telemetry (death heatmaps, per-CP flip counts, squad-spawn locations, time-to-first-contact, SQ-4 variant) is written server-side as per-match JSONL. Persistent stats are out of scope (spec).
**Testing**: Vitest for the shared sim (capture meter, ticket/bleed math, quantization round-trips, prediction replay determinism); bot soak matches for server stability; Playwright E2E for menu/deploy chrome; Pa11y on the menu and deploy routes (in-match canvas excluded, per the `/game/3d` precedent in `config/pa11yci.json`).
**Target Platform**: Browsers with WebGPU or WebGL2 (client); Linux containers on regional hosts (server); GitHub Pages serves the client only.
**Project Type**: Web client + **separate deployable game server** — the first ScriptHammer feature with a non-Pages runtime component.
**Performance Goals**: NFR-001..005 verbatim — ≤20 KB/s down per client at 32 players (≤40 at 64); 30 Hz authoritative tick held under full load; sub-100 ms perceived input latency; lag-comp rewind capped at 250 ms.
**Constraints**: Static export (server is NOT a Next.js API route — see Constitution Check); no-install browser client; Docker-first everywhere including the match server; no design decision may preclude 64 players (NFR-009).
**Scale/Scope**: PRD Phase 0: 16 capsules. Phase 1: 16v16 vertical slice on the north-shore graybox with bots. Phase 2: voice + social layer. Phase 3: 32v32, transport truck, second map.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                        | Compliance | Notes                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Component Structure Compliance                | ✅         | Every UI chrome piece — MainMenu, DeployScreen, SquadMenu, SquadRoster, ScoreboardOverlay, HudChrome, CombatCanvas wrapper — is scaffolded via `pnpm run generate:component` into the 5-file pattern. The ECS sim layer is a library (`shared/`), not a component. |
| II. Test-First Development                       | ✅         | Appendix B math lands as RED Vitest specs before the rules code (flip times 32/21/16 s, B.3 sanity sim as a test); protocol quantization round-trip tests precede the encoder; E2E deploy-screen spec precedes the route.                                          |
| III. PRP Methodology w/ Mandatory Wireframe Gate | ✅         | Wireframes 01–03 signed off into spec.md `## UI Mockup` (deploy screen, squad HUD, scoreboard/tickets). This plan is downstream of that gate.                                                                                                                      |
| IV. Docker-First Development                     | ✅         | Match server, Redis, and LiveKit run as compose services under a `game` profile (mirroring the `supabase` profile). All installs/tests via `docker compose exec scripthammer ...`; server dev via `docker compose --profile game up`.                              |
| V. Progressive Enhancement                       | ✅         | WebGPU → WebGL2 renderer fallback; WebTransport → WebSocket transport fallback (degraded-but-playable, server treats them identically); voice-SFU-unreachable still plays (spec edge case); 44px touch targets on all menu/deploy chrome.                          |
| VI. Privacy & Compliance First                   | ✅         | Voice is PTT-default, never hot-mic without consent; JWTs scoped to match+squad; playtest telemetry is per-match gameplay data with no PII beyond display name; no third-party analytics added; moderation baseline (VC-5) ships WITH voice, not after.            |

**Static-export constraint — explicit callout**: The game server, matchmaker, Redis, and LiveKit SFU are **separate deployables on regional hosts**, never Next.js API routes (`src/app/api/` cannot exist in the static export). The browser client remains a statically exported route on GitHub Pages that dials out to configured server endpoints (`NEXT_PUBLIC_MATCH_ENDPOINT`, `NEXT_PUBLIC_LIVEKIT_URL`). This is the first repo feature with hosted infrastructure outside Pages/Supabase; the spec's Implementation Status notes already flag it, and it is a hosting decision, not a constitution violation. No secrets in the client — voice/match tokens are minted server-side per match.

**No violations to justify.** No Complexity Tracking section needed.

## Project Structure

### Documentation (this feature)

```
features/enhancements/048-combined-arms/
├── 048_combined-arms_feature.md   # Condensed PRP intake (preserved)
├── spec.md                        # Clarified 2026-07-09; wireframes signed off
├── plan.md                        # This file
├── research.md                    # Phase 0 — 8 decisions with rationale
├── quickstart.md                  # Phase 1 — per-PRD-phase run recipes
├── tasks.md                       # /speckit.tasks output (NEXT)
└── wireframes/                    # 01-deploy-screen, 02-squad-hud, 03-scoreboard-tickets
```

### Source code (repository root)

```
shared/                            # NEW pnpm workspace pkg — compiled into BOTH client and server
├── ecs/                           # Plain TS ECS: component stores (SoA typed arrays), systems, world
├── sim/                           # Deterministic fixed-step: movement, capsule sweeps, hitscan rays
├── rules/                         # Capture meter, tickets/bleed, squads, spawn logic, classes
├── protocol/                      # Bit-packed snapshot/input codecs, quantization, delta baselines
└── tuning.ts                      # Appendix B constants, verbatim (research.md Decision 7)

server/                            # NEW deployable — authoritative match server (one match/process)
├── Dockerfile                     # Multi-stage; runs under compose profile `game` in dev
└── src/
    ├── main.ts                    # Boot: load baked terrain, open WT/WS listeners, start tick
    ├── tick.ts                    # 30 Hz fixed loop; owns ALL truth (NFR-002)
    ├── net/                       # WebTransport datagrams + reliable streams; WS fallback; AoI grid + priority accumulator
    ├── lagcomp/                   # 250 ms rewind ring buffer for hitscan (NFR-004)
    ├── voice/                     # LiveKit room provisioning + match/squad-scoped JWT minting
    ├── bots/                      # FR-006 fill bots (navigate lattice, capture, shoot)
    └── telemetry/                 # SC-011 JSONL writers
matchmaker/                        # NEW deployable — stateless assign-to-region service + Redis presence

src/
├── app/game/combined-arms/page.tsx   # NEW — dynamic(() => import(...), { ssr: false }), /game/3d precedent
├── components/combined-arms/          # NEW — 5-file components: MainMenu, DeployScreen, SquadMenu,
│                                      #   SquadRoster, ScoreboardOverlay, HudChrome, CombatCanvas
└── game-client/                       # NEW plain-TS (non-component): prediction/reconciliation,
                                       #   snapshot interpolation buffer, renderer bridge, input sampler

sites/north-shore.json             # NEW committed site config (own ticket; gitignore-allowlisted like chatt)
public/twins/north-shore/          # Bake outputs: terrain.json, streets.json, buildings.json, drape.jpg
docker-compose.yml                 # MODIFY — add profile `game`: matchserver, redis, livekit
config/pa11yci.json                # MODIFY — audit menu/deploy; exclude in-match canvas
```

**Structure Decision**: pnpm workspace so `shared/` compiles into both the Next.js bundle (via `transpilePackages`) and the server build — client prediction is only honest if client and server run byte-identical movement code. React never touches per-frame state: the ECS world ticks on its own accumulator clock; the R3F `<CombatCanvas>` mounts once and hands the render loop to the sim (StageCore's `useFrame(..., 1)` "this loop is authoritative" pattern). HUD chrome reads sim state through a throttled snapshot store (≤10 Hz), never per-frame props.

## Netcode Architecture (PRD Appendix A, normative)

- **Tick**: authoritative 30 Hz fixed tick server-side; positions, health, capture meters, tickets all server-owned. Clients are rendering terminals that predict.
- **Prediction/reconciliation**: local player simulates immediately; inputs carry sequence numbers; on server ack of input N, rewind to authoritative state and replay N+1…current; mispredictions smoothed over ~100 ms, never snapped (NFR-003).
- **Interpolation**: remote entities render ~100 ms in the past between the two most recent snapshots.
- **Lag compensation**: hitscan rewinds hittable entities to the shooter's interpolation timestamp, capped at **250 ms**; projectiles simulate forward with no rewind (leading targets is the skill).
- **Transport**: WebTransport primary — unreliable QUIC datagrams for inputs/snapshots (stale movement dropped, never queued), reliable streams on the same connection for kill confirms, `{cpId, newOwner, tick}` flips (B.4 atomic contract), tickets, squad membership, chat. WebSocket fallback for pre-26.4 Safari and UDP-hostile networks; server treats fallback clients identically.
- **Bandwidth (NFR-001)**: delta compression against per-client acked baselines; quantization (1 cm positions, 16-bit angles, half-float velocities) in bit-packed ArrayBuffers; AoI grid ~50 m cells (full rate ≤~150 m/on-screen, 10 Hz mid-range, position-only heartbeat for distant squadmates/spotted targets); priority accumulator packs highest-priority entities until the per-snapshot byte budget is spent. Budget: ≤20 KB/s @32, ≤40 KB/s @64.

Round-trip data flow, one frame of the local player's life:

```
input sampler ──seq N──▶ predict locally (shared/sim) ──datagram──▶ server tick T
     ▲                          │                                        │
     │                   render immediately                     simulate + lag comp
     │                          ▼                                        ▼
smooth ~100 ms ◀── replay N+1…current ◀──ack N + snapshot◀── delta vs client baseline
```

Remote entities skip the left column entirely: snapshots land in a 100 ms interpolation buffer and render in the past. Reliable-stream events (flips, kills, tickets) bypass the snapshot path and apply atomically on arrival.

## Voice Architecture

Self-hosted **LiveKit** SFU (Apache-2.0, Go/Pion), one deployment per game region, co-located with match servers. The match server provisions rooms on squad create/join and tears down idle channels aggressively (NFR-008). Tokens are per-match JWTs scoped to match + squad ID — a client can never join another squad's channel (VC-3, negative-tested in E2E). Two tiers: squad channel (6 members) and command channel (leaders, second PTT key). PTT default, open-mic opt-in, per-player mute; speaking indicators feed the roster + overhead flashes. VC-5 moderation (leader voice-kick, server mute list, report flow) ships in the same PRD phase as voice — a launch requirement of Phase 2, not a fast-follow. Voice failure is non-fatal by design: the match plays on with a channel-unavailable roster state and background reconnection (spec edge case).

## Map Pipeline (digital twin → graybox)

1. **`sites/north-shore.json`** (own ticket): Coolidge Park / Frazier Ave ~600×600 m box, baked via the #232 pipeline (`pnpm bake --site north-shore`) with #229 lidar heights. Deliberately gitignore-allowlisted like chatt.
2. **`terrain.json` → gameplay heightmap** for BOTH server (collision, lag-comp rewind space) and client (rendering) — one source of truth for ground.
3. **Baked `streets.json`/`buildings.json`** → cover primitives at crouch/stand heights and CP capture volumes authored over real intersections: A = Coolidge Park carousel lawn, B = Walnut St Bridge north landing, C = elevated hill-climb block (center, hardest to hold), D = Frazier Ave strip, E = Renaissance Park knoll; uncapturable home bases NW/SE.
4. **Drape imagery is authoring-only** — used with the `?topdown` diagnostic to place CPs/cover over real geography; the shipped graybox is untextured per Appendix C (readability first; each CP silhouette identifiable at 200 m).

## Server Topology & Environments

- **Match servers**: regional, one match per containerized process (PRD A.4). Crash domain = one match; scaling = scheduling containers. A `/debug/stats` endpoint exposes tick p99 and per-client send rates for the NFR gates.
- **Matchmaker**: stateless HTTP service (`POST /match/assign`) that picks a region + process; Redis holds presence/party state. Nothing persists a match.
- **Voice**: one LiveKit deployment per region, co-located with the match servers it serves.
- **Client**: the existing Next.js static export serves `/game/combined-arms` from GitHub Pages, exactly like every other route — the dynamic `ssr: false` import from the `/game/3d` precedent. Endpoints arrive via `NEXT_PUBLIC_*` config; with none set, the route renders a themed "no server configured" state so the template remains fork-safe.
- **Dev**: everything above runs locally under `docker compose --profile game up` (matchserver + redis + livekit), keeping the loop Docker-first with zero cloud dependency until playtests.

## Delivery Phases (PRD §7) — entry/exit criteria

| PRD Phase          | Entry criteria                                    | Exit criteria                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Netcode spike  | This plan approved; compose `game` profile boots  | 16 capsules move/shoot in a flat graybox with prediction, reconciliation, and lag comp working. **KILL CRITERION**: if perceived latency is unacceptable here (input-to-photon feel at simulated 80 ms RTT + loss), STOP — revisit platform choice before building anything else. |
| 1 — Vertical slice | Phase 0 passed; `sites/north-shore.json` baked    | Full Conquest loop on north-shore graybox: capture/flips/tickets/bleed at Appendix B constants, 4 classes, squad create/join, leader spawn + SQ-4 denial (both flag variants), bots fill 16v16, SC-011 telemetry recording.                                                       |
| 2 — Social layer   | Phase 1 playable end-to-end with bots             | LiveKit squad + command voice with VC-5 moderation, squad orders + score bonuses, spawn waves, medic revives preserving tickets. SC-001/SC-003 measurable.                                                                                                                        |
| 3 — Breadth        | Phase 2 metrics collected from ≥1 playtest cohort | 32v32 holding NFR-001/002 (≤40 KB/s, 30 Hz), transport truck under the same prediction regime, server browser + community hosting; CTF mode.                                                                                                                                      |

## Risks (ranked, from PRD §6)

1. **64-player state replication in browser bandwidth budgets** → delta compression + AoI + priority accumulator; ship 32-player first; budget asserted by a soak-test gate before Phase 3 scale-up.
2. **Cheating — browser clients are hostile territory** → server authority over everything (including capture progress and ammo), sanity checks (speed/RoF caps, impossible angles), statistical outlier review queue, community-server kick/ban; accept the no-kernel-anticheat ceiling — ranked play is a non-goal (research.md Decision 8).
3. **Voice ops cost/abuse** → PTT default, per-match JWTs, aggressive idle-channel teardown, VC-5 moderation shipping with the feature, not after.

## Phase 0 — Research

See [`research.md`](./research.md). Eight decisions recorded with rationale + alternatives: WebTransport-primary transport; authoritative-server simulation model; LiveKit SFU; plain-TS ECS outside React; Node-first server language; twin bake as map source; Appendix B constants as the initial executable spec; honest cheat posture.

## Phase 1 — Design

**Data model**: Key entities per spec (Squad, CP, Ticket Pool, Match, Player, Site Config) live in `shared/ecs` component stores + `shared/rules`; the wire shapes live in `shared/protocol`. No database entities — no `data-model.md` needed beyond this section.
**Contracts**: The bit-packed snapshot/input schema and the reliable-stream event set (including the B.4 `{cpId, newOwner, tick}` flip) are code-first in `shared/protocol` with round-trip tests as the contract. No HTTP contracts; the matchmaker's single `POST /match/assign` is documented inline.
**Quickstart**: See [`quickstart.md`](./quickstart.md) — per-PRD-phase run recipes (spike, math tests, bake, bot match, voice smoke, bandwidth verification).
**Agent context**: `.specify/scripts/bash/update-agent-context.sh claude` (expected no-op; CLAUDE.md is hand-curated).

## Phase 2 — `/speckit.tasks` (next)

`tasks.md` will sequence work to honor the PRD phase gates and keep each user story independently testable (US1 P1 → US5 P3):

1. **Foundation**: pnpm workspace (`shared/`, `server/`, `matchmaker/`), compose `game` profile (matchserver + redis + livekit), Pa11y config, `NEXT_PUBLIC_MATCH_ENDPOINT` plumbing with the themed "no server configured" state.
2. **PRD Phase 0 spike**: protocol codecs (round-trip tests first), 30 Hz tick loop, WebTransport/WS listeners, prediction/reconciliation in `src/game-client/`, flat spike arena + `?spike` debug HUD, fake-lag flags.
3. **KILL-CRITERION checkpoint**: an explicit task whose deliverable is a written go/no-go against quickstart recipe 1 — nothing downstream starts until it passes.
4. **Map**: `sites/north-shore.json` (own ticket, allowlisted), terrain→heightmap adapter shared by server + client, CP volumes + cover primitives authored via `?topdown`.
5. **US-1 Conquest loop (P1)**: Appendix B RED tests → capture/tickets/bleed rules → B.4 flip contract → DeployScreen + ScoreboardOverlay chrome (wireframes 01, 03) → bots (FR-006).
6. **US-2 leader spawn (P1)**: squad create/join, leader spawn placement + protection shimmer, SQ-4 denial behind the server flag (both presentations), succession.
7. **US-3 voice + US-4 classes (P2)**: LiveKit provisioning + JWTs + moderation baseline; four classes, medic revive preserving tickets, spotting; SquadRoster/HudChrome indicators (wireframe 02).
8. **US-5 scale (P3)**: transport truck under the shared prediction regime, 32v32 soak against the NFR-001/002 gate (quickstart recipe 6), telemetry dashboards for SC-009..011.

Each user story (or independent technical concern) gets its own commit so the PR history reflects the cascade.

## Constitution re-check (post-Phase 1)

All six principles still ✅. The one structural novelty — hosted game-server infrastructure outside GitHub Pages — is isolated in `server/`/`matchmaker/`, is Docker-first by construction, and never leaks into the static client except as public endpoint config. Everything React-facing extends existing patterns: dynamic-import-no-SSR from `/game/3d`, authoritative render loop from `src/stage/StageCore.tsx`, DaisyUI theming from 047, 5-file components from everywhere.
