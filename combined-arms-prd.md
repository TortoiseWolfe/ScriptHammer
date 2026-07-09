# PRD — Project COMBINED ARMS

### A Squad-Centric Large-Scale Multiplayer FPS (Battlefield 2-Inspired)

**Author:** Jonathan "TurtleWolfe" Pohlner / ScriptHammer
**Status:** Draft v0.1
**Date:** July 2026

---

## 1. Overview

Project COMBINED ARMS is a large-scale, team-based multiplayer first-person shooter built around three interlocking innovations that Battlefield 2 (2005) proved out and that no browser-native game has faithfully reproduced together:

1. **Squad Leader as Mobile Spawn Point** — the single most important social mechanic in the genre's history. It transformed random pub players into cohesive fireteams because dying no longer meant a 60-second walk back to the fight.
2. **Per-Squad Voice Channels** — automatic, zero-configuration VOIP scoped to your 6-person squad, with a separate command channel between squad leaders and the commander.
3. **Conquest Control Points with Dynamic Spawn Ownership** — capturable flags that flip which team can spawn at them, creating a constantly shifting front line and the "ticket bleed" pressure that gives matches a narrative arc.

The design thesis: **these three features are one feature.** Squad spawn gives players a reason to stay together. Squad voice gives them the means to coordinate. Conquest spawn ownership gives them something worth coordinating _about_. Removing any leg collapses the stool — which is why so many BF2 imitators that cherry-picked one mechanic failed to recapture the magic.

This is a clean-room, mechanics-inspired design. No EA/DICE names, assets, maps, or branding are used. Game mechanics are not copyrightable; trade dress and assets are.

---

## 2. Goals & Non-Goals

### Goals

- Recreate the squad-coordination gameplay loop of BF2-era combined arms at a scope achievable by a small team.
- Ship a browser-playable vertical slice (WebGL/WebGPU) that demonstrates all three pillar mechanics in one match.
- 32-player matches at MVP (16v16), with 64-player (32v32) as a stretch target.
- Sub-100ms perceived responsiveness via client-side prediction and lag compensation.

### Non-Goals (MVP)

- Vehicles beyond one light ground transport (jets, helicopters, armor are Phase 3+).
- Commander role with artillery/UAV/supply drops (Phase 2 — squad leaders come first).
- Ranked progression, unlocks, persistent stats.
- Console/native clients.
- Destructible environments.

---

## 3. Target Audience

- Primary: PC players aged 25–45 nostalgic for BF2/2142/Project Reality-era teamplay, underserved by modern hero-shooter and battle-royale design.
- Secondary: Squad/Hell Let Loose players who want a lower-friction, browser-accessible tactical shooter for shorter sessions.
- Tertiary: streamers/communities who want organized squad-vs-squad scrims without installs.

---

## 4. Core Pillars & Feature Requirements

### Pillar 1 — Squad System with Mobile Spawn

The squad is the atomic social unit. Everything else serves it.

**Requirements:**

- **SQ-1:** Squads hold up to 6 players. Players may create a squad (becoming leader), join an open squad, or play as lone wolf (with reduced spawn options — lone wolves may only spawn at controlled flags).
- **SQ-2:** **Squad Leader Spawn:** any squad member may spawn on the squad leader's position if the leader is alive and not in a contested "combat-denied" state (see SQ-4). Spawn occurs 1–3 m behind the leader's facing, with a brief spawn-protection shimmer (1.5 s or until the player fires/moves aggressively).
- **SQ-3:** Leadership succession: if the leader leaves, leadership auto-passes to the longest-tenured member. Leader may also hand off manually. If the leader dies, squad spawn is unavailable until the leader respawns — this is the core risk/reward: **protect your leader.**
- **SQ-4:** Combat-denial rule (anti-spawn-camping of the mechanic itself): squad spawn is disabled for 8 seconds after the leader takes damage. This prevents "meat-grinder teleporter" degenerate play while preserving the forward-spawn fantasy.
- **SQ-5:** Squad leader gets a unique map icon visible to their squad, an order system (Attack / Defend / Move marker placed on the map or via 3D world ping), and passive score bonuses when squadmates act on orders (spawn-on-leader, capture near marker, kill near marker).
- **SQ-6:** Squad UI: persistent left-edge roster showing member names, health state, alive/dead, class icon, and leader star. One-key squad menu (default: Caps or B) for join/leave/create.

**Success looks like:** ≥70% of players in a match are in squads; ≥50% of all spawns in a match are squad-leader spawns.

### Pillar 2 — Squad Voice Channels

**Requirements:**

- **VC-1:** Joining a squad automatically joins its voice channel. Zero configuration. Push-to-talk default with open-mic option; per-player mute.
- **VC-2:** Two-tier comms: **Squad channel** (all 6 members) and **Command channel** (squad leaders + commander when that role ships). Leaders hold a second PTT key for command net — the BF2 pattern that made leaders feel like leaders.
- **VC-3:** Built on WebRTC (browser-native, no plugin): SFU architecture (e.g., LiveKit or mediasoup) rather than mesh, so a 6-person channel costs each client one uplink. Voice server co-located with game region.
- **VC-4:** Speaking indicator on the squad roster UI and above teammate heads (name flashes) so voice is legible even to non-speakers.
- **VC-5:** Moderation baseline: squad leader may voice-kick from squad; server-level mute list; report flow. (Voice moderation is the #1 operational risk of this feature — budget for it.)
- **VC-6:** Optional positional/proximity local channel is explicitly **out of scope** for MVP; it dilutes the squad-channel design.

**Success looks like:** ≥40% of squads have at least 2 members using voice in an average match.

### Pillar 3 — Conquest: Control Points with Dynamic Spawn Ownership

This is the mode you described — and the key distinction from capture-the-flag: in CTF you carry an object to your base; in **Conquest** the flags are territory, and owning a flag _changes where your team can spawn_. That spawn-map mutation is what creates front lines.

**Requirements:**

- **CQ-1:** Maps contain 5–7 control points (CPs) plus 0–2 uncapturable home bases per team (map-dependent; some maps have no safe base, enabling total-victory "base rape" only if intentional in layout).
- **CQ-2:** **Capture logic:** a CP has a capture radius and a meter from −100 (enemy) through 0 (neutral) to +100 (friendly). Players in radius push the meter at a rate scaled by headcount advantage (diminishing returns after 3 players). A held enemy flag must be neutralized before it can be captured — two-stage flips, exactly the BF2 rhythm.
- **CQ-3:** **Spawn ownership flip:** the moment a CP crosses to fully captured, it appears as a spawn option for the capturing team and disappears for the losing team. Players mid-spawn-countdown on a lost flag are bounced back to spawn selection. This is the feature; it must feel instant and unambiguous (map flash + audio sting + kill-feed style banner).
- **CQ-4:** **Tickets:** each team starts with a ticket pool (e.g., 300). Tickets drain on respawn (1 per death) and via **bleed**: when a team holds fewer than half the CPs (or zero, for accelerated bleed), it loses tickets over time. First team to 0 loses. Bleed is the strategic clock that forces attacking rather than turtling.
- **CQ-5:** Spawn selection screen: top-down map with selectable owned CPs + squad leader icon. Spawn wave timer (10 s cadence) so squads re-enter together.
- **CQ-6:** Secondary mode (Phase 3): classic CTF using the same maps, as a community/scrim mode. Explicitly not the flagship.

**Success looks like:** average match sees ≥8 spawn-ownership flips; median match duration 15–25 minutes; comeback rate (team behind at half-tickets wins) between 15–30%.

---

## 5. Supporting Systems (MVP)

**Classes (4 at MVP):** Assault (rifle + grenades), Medic (heal/revive — critical, because revives preserve tickets and reward squad cohesion), Support (LMG + ammo resupply), Recon (marksman + spotting). Anti-tank and Engineer arrive with vehicles.

**Spotting:** aim + Q pings an enemy for your squad (3D marker, 6 s). Feeds the "squad as sensor network" fantasy and gives non-shooters a contribution path.

**Movement:** deliberate, BF2-weight — sprint with stamina, no slide-canceling, no advanced movement tech. TTK moderate (3–5 body shots). The game rewards positioning and coordination, not twitch.

**One transport vehicle:** open-top 4-seat truck. It exists at MVP purely to prove vehicle netcode and to give squads a reason to move as a unit between flags.

**Maps:** one MVP map, ~600 m × 600 m, 5 CPs in the classic BF2 "lattice" (two lanes + contested center), authored for 16v16 with 32v32 headroom.

---

## 6. Technical Approach

**Client:** Three.js / React Three Fiber shell (menus, spawn map, squad UI in React; simulation in a plain TS/ECS layer — R3F for scene management, not per-frame game logic). WebGPU renderer with WebGL2 fallback. This keeps the project consistent with the existing ScriptHammer R3F design system for UI chrome, while acknowledging an FPS at this scale needs a custom simulation loop outside React's reconciler.

**Netcode:** authoritative server (Node/TypeScript or Rust) at 30 Hz tick, client prediction + reconciliation for local movement, snapshot interpolation (100 ms buffer) for remote entities, lag-compensated hitscan (server rewind). Transport: WebTransport (QUIC datagrams) primary, WebSocket fallback. Interest management via grid partitioning so 64 players doesn't mean 64× entity replication per client.

**Voice:** WebRTC via SFU (LiveKit self-hosted or mediasoup), channels provisioned by the game server on squad create/join, tokens scoped per match.

**Hosting:** regional game servers (containerized, one match per process), matchmaker + lobby service, voice SFU per region.

**Key technical risks, ranked:**

1. 64-player state replication in browser bandwidth budgets → mitigate with delta compression + interest management; ship 32-player first.
2. Cheating (browser clients are hostile territory) → authoritative server for everything, hitscan validation, statistical anomaly detection; accept that browser FPS anti-cheat is a hard ceiling and lean on server authority + community servers.
3. WebRTC voice ops cost/abuse → PTT default, per-match tokens, aggressive idle-channel teardown.

---

## 7. Phasing

**Phase 0 — Netcode Spike (4–6 wks):** 16 capsules moving/shooting in a graybox with prediction/reconciliation/lag comp working. Kill criterion: if perceived latency isn't acceptable here, revisit platform choice before building anything else.

**Phase 1 — Vertical Slice (8–10 wks):** one map, 4 classes, full Conquest loop (capture, spawn flips, tickets, bleed), squad create/join, squad-leader spawn with combat-denial rule. Bots to fill servers for testing.

**Phase 2 — The Social Layer (6–8 wks):** WebRTC squad voice + command channel, squad orders and score bonuses, spawn waves, medic revives. This phase is where the game becomes _the game_.

**Phase 3 — Breadth:** 32v32, second map, transport vehicle, commander role, CTF community mode, server browser + community-hosted servers.

---

## 8. Success Metrics

- **North star:** % of spawns that are squad-leader spawns (proxy for whether the core loop works). Target ≥50%.
- Squad participation rate ≥70%; voice usage ≥40% of squads.
- Median session ≥2 matches; D7 retention ≥15% for a playtest cohort.
- Match competitiveness: winner's remaining tickets ≤40% of starting pool in median match (blowouts indicate map/bleed tuning failure).

## 9. Open Questions

- Free weekend playtests vs. closed alpha with the Twitch community as seed cohort?
- Monetization posture (cosmetics-only? server hosting? none during alpha?) — deliberately deferred; nothing in this design depends on it.
- Does lone-wolf play need more accommodation, or is "squads are strictly better" the correct pressure?
- Should the combat-denial timer (SQ-4) be visible to the squad ("spawn available in 4…3…") or opaque? Playtest both.

---

# Appendix A — Netcode Architecture Deep-Dive

## A.1 Transport layer (updated with July 2026 research)

The transport picture improved materially in early 2026: WebTransport is now **Baseline** across all major browsers. Safari 26.4 (March 2026) was the last holdout to ship it, joining Chrome 97+, Edge 98+, and Firefox 114+. This removes the biggest historical objection to a browser-native FPS — that iOS/macOS users would be stuck on TCP.

**Decision:** WebTransport primary, WebSocket fallback.

- **Unreliable datagrams** carry per-tick state: input packets (client→server) and world snapshots (server→client). Stale movement data should be dropped, never queued — this is exactly what TCP-based WebSockets get wrong (head-of-line blocking: one lost packet stalls everything behind it).
- **Reliable streams** (multiplexed on the same QUIC connection) carry events that must arrive: kill confirmations, capture-state changes, ticket updates, squad membership changes, chat.
- **WebSocket fallback** remains necessary for pre-26.4 Safari users and QUIC-hostile networks (some corporate/school firewalls block UDP). Fallback clients get a degraded-but-playable experience; the server treats them identically, they just eat more latency variance. WebTransport can also fall back to HTTP/2 with the same API when QUIC is blocked.

## A.2 Simulation model

**Authoritative server, 30 Hz fixed tick.** The server owns all truth: positions, health, capture meters, tickets. Clients are rendering terminals that predict.

**Client-side prediction (local player):** the client simulates its own movement immediately on input, tags each input with a sequence number, and sends it. When a server snapshot arrives acknowledging input N, the client rewinds to the server's authoritative state and replays inputs N+1…current. If the replayed position differs from the predicted one (misprediction), the correction is smoothed over ~100 ms rather than snapped.

**Snapshot interpolation (remote players):** remote entities render ~100 ms in the past, interpolating between the two most recent snapshots. This makes other players' movement smooth at the cost of seeing a slightly delayed world — the standard Source/Battlefield trade.

**Lag-compensated hitscan:** when a shot arrives, the server rewinds all hittable entities to where the shooter _saw_ them (shooter's interpolation timestamp), tests the hit, then restores. Rewind window capped at 250 ms so high-ping players can't shoot too far into the past. Projectiles (grenades, future vehicle shells) are simulated forward server-side with no rewind — they're slow enough that leading targets is the intended skill.

## A.3 Bandwidth budget & interest management

Naive replication of 64 players at 30 Hz breaks browser budgets fast, so:

- **Delta compression:** each snapshot encodes only fields changed since the last client-acknowledged snapshot (per-client baselines).
- **Quantization:** positions to 1 cm ints, view angles to 16-bit, velocities to half-floats. Bit-packed, not JSON — flat ArrayBuffers with a hand-rolled schema (or FlatBuffers).
- **Interest management / AoI:** grid partition (~50 m cells). Full-rate updates for entities within ~150 m or on the player's screen; 10 Hz for mid-range; position-only heartbeat for distant squadmates/spotted targets (needed for map icons). Target: **≤ 20 KB/s down per client at 32 players**, ≤ 40 KB/s at 64.
- **Priority accumulator:** every entity accrues send-priority each tick (scaled by proximity, visibility, recent damage events); each snapshot packs highest-priority entities until the byte budget is spent. This is how BF-era engines gracefully degrade under load instead of stuttering.

## A.4 Server topology

One match = one process (Node/TS is viable at 32 players; Rust if profiling says otherwise at 64). Stateless matchmaker assigns players to regional match servers; Redis for presence/party state. Voice SFU (see Appendix on voice: LiveKit — open-source, Apache 2.0, Go/Pion SFU, free to self-host, with Unity-WebGL and JS SDKs already proven in games) runs per-region, with rooms created via server SDK at squad creation and torn down on disband. Squad voice tokens are JWTs scoped to match + squad ID so a client can never join another squad's channel.

## A.5 Cheat posture (honest version)

Browser clients mean no kernel anti-cheat, ever. Mitigations, in order of value: (1) server authority over everything including capture progress and ammo; (2) server-side sanity checks — speed caps, rate-of-fire caps, impossible-angle detection; (3) statistical outlier flagging (headshot %, reaction-time distributions) feeding a review queue; (4) community servers with admin kick/ban as the social immune system — this was genuinely load-bearing in BF2's era and is cheap to build. Accept the ceiling; design around it by making ranked play a non-goal.

---

# Appendix B — Capture & Ticket-Bleed Tuning Math

## B.1 Capture meter

Meter range −100…+100. Base capture rate: **6.25 points/sec** for one player (full flip from −100 to +100 in 32 s solo; neutralize in 16 s).

Headcount scaling with diminishing returns — effective rate = base × (1 + 0.5·(n−1)) capped at n=3:

| Players in radius (net advantage) | Multiplier | Full flip time |
| --------------------------------- | ---------- | -------------- |
| 1                                 | 1.0×       | 32 s           |
| 2                                 | 1.5×       | ~21 s          |
| 3+                                | 2.0×       | 16 s           |

Contested (both teams in radius): meter freezes. This rewards sending a defender rather than making capture a pure DPS race. Capture radius 20–30 m depending on CP (interior points smaller). Progress **decays back toward the owner's state at 2 pts/sec** when attackers leave — partial caps shouldn't persist forever, but shouldn't vanish instantly either, so a squad can rotate off briefly.

## B.2 Ticket model

Start: **300 tickets/team** (16v16). Drains:

1. **Respawn cost:** 1 ticket per spawn (not per death — a medic revive within the 10 s bleed-out window costs zero tickets; this is _the_ mechanical reason Medic matters and squads that stick together win the attrition war).
2. **Majority bleed:** hold < half the CPs (≤2 of 5) → lose **1 ticket / 5 s**.
3. **Total-control bleed:** hold zero CPs → **1 ticket / 2 s** (accelerated collapse; prevents zombie matches).

## B.3 Sanity-check simulation

Assume 16v16, 300 tickets, a 20-minute reference match, average player dies once per 75 s:

- Death-driven drain: 16 players × (1200 s / 75 s) ≈ 256 deaths; with ~25% revived, ≈ **192 tickets** from spawns.
- Bleed-driven drain on the losing side: if behind on flags for ~half the match, 600 s × 0.2/s = **120 tickets**.
- Total losing-team drain ≈ 312 → hits zero right around the 20-minute mark. ✔ The knobs (start pool, bleed interval, revive rate) land the target 15–25 min median without any one system dominating.

**Tuning levers, in order of preference when playtests misbehave:** bleed interval first (shapes strategy), starting pool second (shapes duration), respawn cost last (touches everything). Comeback health check: if <15% of matches see the trailing-at-half team win, weaken bleed; if >30%, holding flags isn't rewarding enough.

## B.4 Spawn-flip event contract

The CQ-3 flip must be atomic and broadcast on the **reliable** stream: `{cpId, newOwner, tick}`. Server invalidates queued spawns on that CP in the same tick; clients on the deploy screen get the flag icon swap + audio sting within one RTT. Any window where a player spawns at a just-lost flag reads as a bug and poisons trust in the core mechanic — this is a correctness requirement, not polish.

---

# Appendix C — Graybox Map Layout: "First Map" 5-CP Lattice

600 m × 600 m playable, 16v16. Classic two-lane-plus-center topology (the BF2 Strike-at-Karkand / Sharqi family of layouts):

```
        NORTH LANE
  [US BASE]──(A)─────(B)
      │       │    ╲   │
      │       │    (C) │        C = center, elevated,
      │       │    ╱   │            hard to hold
      └──────(D)─────(E)──[OP BASE]
        SOUTH LANE
```

- **Home bases:** uncapturable, one per team, diagonal corners (NW / SE). Each has a soft out-of-bounds "main protection" zone the enemy can't enter — prevents spawn-camping the last spawn without needing invisible walls elsewhere.
- **A & E — "front porch" CPs:** ~120 m from each home base. Open approach from the owner's side, covered approach from the enemy's side, so losing your porch flag is recoverable but embarrassing.
- **B & D — lane anchors:** mid-lane, medium cover density, 25 m capture radius. These flip most often; the front line usually lives here.
- **C — center:** elevated (rooftop/hill), small 18 m radius, sightlines into both lanes but exposed to both. Holding C plus your lane = 3/5 flags = enemy bleeds. C is deliberately the _hardest_ flag to hold so the bleed advantage demands continuous investment.
- **Travel-time targets:** adjacent CPs 25–35 s on foot (sprint), which makes the squad-leader spawn worth ~30 s per death saved — big enough to matter, small enough that losing your leader isn't a match-loss. The one transport truck cuts cross-map (base→far lane) from ~90 s to ~35 s, giving squads a reason to mount up together at round start.
- **Graybox pass contents (Phase 1):** terrain heightmap, CP capture volumes, ~40 cover primitives per lane (crates/walls at crouch and stand heights), two elevation changes per lane, spawn-point clusters (4–6 points per CP, facing cover, ≥8 m from the flagpole so spawners aren't standing on the objective). No art. Readability first: each CP silhouette must be identifiable at 200 m.

**Playtest instrumentation for this map:** heatmap deaths, per-CP flip counts, squad-spawn locations, and time-to-first-contact from each spawn cluster. The lattice succeeds if B/D flip 3–4× as often as A/E and C changes hands most of all.
