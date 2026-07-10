# Feature: COMBINED ARMS

**Feature ID**: 048
**Category**: enhancements
**Status**: Draft
**Date**: 2026-07-09
**Source**: `combined-arms-prd.md` (repo root) — PRD Draft v0.1, July 2026. This document condenses that PRD faithfully for SpecKit intake; the PRD remains authoritative for detail not reproduced here.

## Overview

Project COMBINED ARMS is a large-scale, team-based multiplayer first-person shooter built around three interlocking innovations that Battlefield 2 (2005) proved out and that no browser-native game has faithfully reproduced together:

1. **Squad Leader as Mobile Spawn Point** — the genre's most important social mechanic. Dying no longer means a 60-second walk back to the fight, so random pub players cohere into fireteams.
2. **Per-Squad Voice Channels** — automatic, zero-configuration VOIP scoped to your 6-person squad, with a separate command channel between squad leaders (and, later, a commander).
3. **Conquest Control Points with Dynamic Spawn Ownership** — capturable flags that flip which team can spawn at them, creating a shifting front line and "ticket bleed" pressure that gives matches a narrative arc.

**Design thesis: these three features are one feature.** Squad spawn gives players a reason to stay together. Squad voice gives them the means to coordinate. Conquest spawn ownership gives them something worth coordinating about. Removing any leg collapses the stool — BF2 imitators that cherry-picked one mechanic failed to recapture the magic.

Clean-room, mechanics-inspired design. No EA/DICE names, assets, maps, or branding. Game mechanics are not copyrightable; trade dress and assets are.

## Goals

- Recreate the squad-coordination gameplay loop of BF2-era combined arms at a scope achievable by a small team.
- Ship a browser-playable vertical slice (WebGL/WebGPU) demonstrating all three pillar mechanics in one match.
- 32-player matches at MVP (16v16), with 64-player (32v32) as a stretch target.
- Sub-100 ms perceived responsiveness via client-side prediction and lag compensation.

## Non-Goals (MVP)

- Vehicles beyond one light ground transport (jets, helicopters, armor are Phase 3+).
- Commander role with artillery/UAV/supply drops (Phase 2 — squad leaders come first).
- Ranked progression, unlocks, persistent stats.
- Console/native clients.
- Destructible environments.

## Target Audience

- **Primary**: PC players aged 25–45 nostalgic for BF2/2142/Project Reality-era teamplay, underserved by modern hero-shooter and battle-royale design.
- **Secondary**: Squad / Hell Let Loose players who want a lower-friction, browser-accessible tactical shooter for shorter sessions.
- **Tertiary**: streamers/communities who want organized squad-vs-squad scrims without installs.

## Pillar 1 — Squad System with Mobile Spawn

The squad is the atomic social unit. Everything else serves it.

- **SQ-1**: Squads hold up to 6 players. Players may create a squad (becoming leader), join an open squad, or play as lone wolf (reduced spawn options — lone wolves may only spawn at controlled flags).
- **SQ-2**: **Squad Leader Spawn**: any squad member may spawn on the squad leader's position if the leader is alive and not in a contested "combat-denied" state (SQ-4). Spawn occurs 1–3 m behind the leader's facing, with a brief spawn-protection shimmer (1.5 s or until the player fires/moves aggressively).
- **SQ-3**: Leadership succession: if the leader leaves, leadership auto-passes to the longest-tenured member; manual hand-off also supported. If the leader dies, squad spawn is unavailable until the leader respawns — the core risk/reward: **protect your leader**.
- **SQ-4**: Combat-denial rule (anti-spawn-camping of the mechanic itself): squad spawn is disabled for 8 seconds after the leader takes damage. Prevents "meat-grinder teleporter" degenerate play while preserving the forward-spawn fantasy.
- **SQ-5**: Squad leader gets a unique map icon visible to their squad, an order system (Attack / Defend / Move marker on the map or via 3D world ping), and passive score bonuses when squadmates act on orders (spawn-on-leader, capture near marker, kill near marker).
- **SQ-6**: Squad UI: persistent left-edge roster showing member names, health state, alive/dead, class icon, leader star. One-key squad menu (default: Caps or B) for join/leave/create.

Success looks like: ≥70% of players in a match are in squads; ≥50% of all spawns are squad-leader spawns.

## Pillar 2 — Squad Voice Channels

- **VC-1**: Joining a squad automatically joins its voice channel. Zero configuration. Push-to-talk default with open-mic option; per-player mute.
- **VC-2**: Two-tier comms: **Squad channel** (all 6 members) and **Command channel** (squad leaders + commander when that role ships). Leaders hold a second PTT key for the command net.
- **VC-3**: Built on WebRTC (browser-native, no plugin): SFU architecture (e.g., LiveKit or mediasoup) rather than mesh, so a 6-person channel costs each client one uplink. Voice server co-located with game region.
- **VC-4**: Speaking indicator on the squad roster UI and above teammate heads (name flashes) so voice is legible even to non-speakers.
- **VC-5**: Moderation baseline: squad leader may voice-kick from squad; server-level mute list; report flow. Voice moderation is the #1 operational risk of this feature — budget for it.
- **VC-6**: Positional/proximity local channel is explicitly **out of scope** for MVP; it dilutes the squad-channel design.

Success looks like: ≥40% of squads have at least 2 members using voice in an average match.

## Pillar 3 — Conquest: Control Points with Dynamic Spawn Ownership

Distinct from CTF: in Conquest the flags are territory, and owning a flag changes where your team can spawn. That spawn-map mutation is what creates front lines.

- **CQ-1**: Maps contain 5–7 control points (CPs) plus 0–2 uncapturable home bases per team (map-dependent).
- **CQ-2**: **Capture logic**: a CP has a capture radius and a meter from −100 (enemy) through 0 (neutral) to +100 (friendly). Players in radius push the meter at a rate scaled by headcount advantage (diminishing returns after 3 players). A held enemy flag must be neutralized before it can be captured — two-stage flips, exactly the BF2 rhythm.
- **CQ-3**: **Spawn ownership flip**: the moment a CP crosses to fully captured, it appears as a spawn option for the capturing team and disappears for the losing team. Players mid-spawn-countdown on a lost flag are bounced back to spawn selection. This is the feature; it must feel instant and unambiguous (map flash + audio sting + kill-feed-style banner).
- **CQ-4**: **Tickets**: each team starts with a ticket pool (e.g., 300). Tickets drain on respawn (1 per death) and via **bleed**: when a team holds fewer than half the CPs (or zero, for accelerated bleed), it loses tickets over time. First team to 0 loses. Bleed is the strategic clock that forces attacking rather than turtling.
- **CQ-5**: Spawn selection screen: top-down map with selectable owned CPs + squad leader icon. Spawn wave timer (10 s cadence) so squads re-enter together.
- **CQ-6**: Secondary mode (Phase 3): classic CTF on the same maps, as a community/scrim mode. Explicitly not the flagship.

Success looks like: ≥8 spawn-ownership flips per average match; median match 15–25 minutes; comeback rate (team behind at half-tickets wins) 15–30%.

## Supporting Systems (MVP)

- **Classes (4 at MVP)**: Assault (rifle + grenades), Medic (heal/revive — critical: revives preserve tickets and reward squad cohesion), Support (LMG + ammo resupply), Recon (marksman + spotting). Anti-tank and Engineer arrive with vehicles.
- **Spotting**: aim + Q pings an enemy for your squad (3D marker, 6 s). Feeds the "squad as sensor network" fantasy; gives non-shooters a contribution path.
- **Movement**: deliberate, BF2-weight — sprint with stamina, no slide-canceling, no advanced movement tech. TTK moderate (3–5 body shots). Rewards positioning and coordination, not twitch.
- **One transport vehicle**: open-top 4-seat truck. Exists at MVP purely to prove vehicle netcode and to give squads a reason to move as a unit between flags.
- **Maps**: one MVP map, ~600 m × 600 m, 5 CPs in the classic BF2 "lattice" (two lanes + contested center), authored for 16v16 with 32v32 headroom.

## Technical Approach (summary)

**Client**: Three.js / React Three Fiber shell — menus, spawn map, squad UI in React; simulation in a plain TS/ECS layer (R3F for scene management, not per-frame game logic). WebGPU renderer with WebGL2 fallback. Consistent with ScriptHammer's R3F design system for UI chrome, while acknowledging an FPS at this scale needs a custom simulation loop outside React's reconciler.

**Transport** (Appendix A.1): WebTransport (QUIC) primary — Baseline in all major browsers since Safari 26.4 (March 2026) — with WebSocket fallback for pre-26.4 Safari and QUIC-hostile networks (fallback clients get a degraded-but-playable experience; the server treats them identically).

- **Unreliable datagrams** carry per-tick state: input packets (client→server) and world snapshots (server→client). Stale movement data is dropped, never queued — exactly what TCP WebSockets get wrong (head-of-line blocking).
- **Reliable streams** (same QUIC connection) carry must-arrive events: kill confirmations, capture-state changes, ticket updates, squad membership changes, chat.

**Simulation model** (A.2): authoritative server (Node/TypeScript; Rust if profiling says otherwise at 64) at **30 Hz fixed tick** owning all truth — positions, health, capture meters, tickets. Clients are rendering terminals that predict:

- **Client-side prediction** (local player): simulate immediately on input, tag inputs with sequence numbers; on server ack of input N, rewind to authoritative state and replay N+1…current; smooth mispredictions over ~100 ms.
- **Snapshot interpolation** (remote players): render ~100 ms in the past between the two most recent snapshots.
- **Lag-compensated hitscan**: server rewinds hittable entities to the shooter's interpolation timestamp, tests, restores; rewind capped at **250 ms**. Projectiles simulate forward with no rewind — leading targets is the intended skill.

**Bandwidth & interest management** (A.3): delta compression against per-client acked baselines; quantization (1 cm positions, 16-bit angles, half-float velocities) in bit-packed ArrayBuffers, not JSON; interest management via ~50 m grid cells (full rate within ~150 m or on-screen, 10 Hz mid-range, position-only heartbeat for distant squadmates/spotted targets); priority accumulator packs highest-priority entities per snapshot until the byte budget is spent. Target **≤20 KB/s down per client at 32 players, ≤40 KB/s at 64**.

**Voice**: WebRTC via SFU (LiveKit self-hosted or mediasoup); channels provisioned by the game server on squad create/join; JWT tokens scoped per match + squad ID so a client can never join another squad's channel; aggressive idle-channel teardown.

**Hosting**: one match = one containerized process on regional game servers; stateless matchmaker + lobby service; Redis for presence/party; voice SFU per region.

**Cheat posture (honest, A.5)**: browser clients mean no kernel anti-cheat, ever. Mitigations by value: (1) server authority over everything including capture progress and ammo; (2) server-side sanity checks — speed caps, rate-of-fire caps, impossible-angle detection; (3) statistical outlier flagging (headshot %, reaction-time distributions) feeding a review queue; (4) community servers with admin kick/ban as the social immune system. Accept the ceiling; design around it by making ranked play a non-goal.

**Key technical risks, ranked**:

1. 64-player state replication in browser bandwidth budgets → delta compression + interest management; ship 32-player first.
2. Cheating (browser clients are hostile territory) → authoritative server for everything; accept the anti-cheat ceiling.
3. WebRTC voice ops cost/abuse → PTT default, per-match tokens, aggressive idle-channel teardown.

## Phasing

- **Phase 0 — Netcode Spike (4–6 wks)**: 16 capsules moving/shooting in a graybox with prediction/reconciliation/lag comp working. Kill criterion: if perceived latency isn't acceptable here, revisit platform choice before building anything else.
- **Phase 1 — Vertical Slice (8–10 wks)**: one map, 4 classes, full Conquest loop (capture, spawn flips, tickets, bleed), squad create/join, squad-leader spawn with combat-denial rule. Bots to fill servers for testing.
- **Phase 2 — The Social Layer (6–8 wks)**: WebRTC squad voice + command channel, squad orders and score bonuses, spawn waves, medic revives. This phase is where the game becomes _the game_.
- **Phase 3 — Breadth**: 32v32, second map, transport vehicle, commander role, CTF community mode, server browser + community-hosted servers.

## Success Metrics

- **North star**: % of spawns that are squad-leader spawns (proxy for whether the core loop works). Target ≥50%.
- Squad participation rate ≥70%; voice usage ≥40% of squads.
- Median session ≥2 matches; D7 retention ≥15% for a playtest cohort.
- Match competitiveness: winner's remaining tickets ≤40% of starting pool in the median match (blowouts indicate map/bleed tuning failure).

## Open Questions (from PRD §9)

- Free weekend playtests vs. closed alpha with the Twitch community as seed cohort?
- Monetization posture — deliberately deferred; nothing in this design depends on it.
- Does lone-wolf play need more accommodation, or is "squads are strictly better" the correct pressure?
- Should the combat-denial timer (SQ-4) be visible to the squad ("spawn available in 4…3…") or opaque? Playtest both.

## Appendix (condensed) — Capture & Ticket-Bleed Tuning Math

**Capture meter** (PRD Appendix B.1): range −100…+100. Base capture rate **6.25 points/sec** for one player (full flip from −100 to +100 in 32 s solo; neutralize in 16 s). Headcount scaling with diminishing returns — effective rate = base × (1 + 0.5·(n−1)), capped at n=3:

| Players in radius (net advantage) | Multiplier | Full flip time |
| --------------------------------- | ---------- | -------------- |
| 1                                 | 1.0×       | 32 s           |
| 2                                 | 1.5×       | ~21 s          |
| 3+                                | 2.0×       | 16 s           |

Contested (both teams in radius): meter freezes — rewards sending a defender rather than making capture a pure DPS race. Capture radius 20–30 m depending on CP (interior points smaller). Progress decays back toward the owner's state at 2 pts/sec when attackers leave.

**Ticket model** (B.2): start **300 tickets/team** (16v16). Drains:

1. **Respawn cost**: 1 ticket per spawn (not per death — a medic revive within the 10 s bleed-out window costs zero tickets; _the_ mechanical reason Medic matters).
2. **Majority bleed**: hold < half the CPs (≤2 of 5) → lose **1 ticket / 5 s**.
3. **Total-control bleed**: hold zero CPs → **1 ticket / 2 s** (accelerated collapse; prevents zombie matches).

**Sanity-check simulation** (B.3): 16v16, 300 tickets, 20-minute reference match, average player dies once per 75 s. Death-driven drain: 16 × (1200/75) ≈ 256 deaths; with ~25% revived, ≈ **192 tickets** from spawns. Bleed on the losing side: behind on flags ~half the match → 600 s × 0.2/s = **120 tickets**. Total losing-team drain ≈ 312 → hits zero right around the 20-minute mark. The knobs (start pool, bleed interval, revive rate) land the 15–25 min median without any one system dominating.

**Tuning levers, in order of preference**: bleed interval first (shapes strategy), starting pool second (shapes duration), respawn cost last (touches everything). Comeback health check: if <15% of matches see the trailing-at-half team win, weaken bleed; if >30%, holding flags isn't rewarding enough.

**Spawn-flip event contract** (B.4): the CQ-3 flip must be atomic and broadcast on the **reliable** stream: `{cpId, newOwner, tick}`. Server invalidates queued spawns on that CP in the same tick; deploy-screen clients get the icon swap + audio sting within one RTT. Any window where a player spawns at a just-lost flag reads as a bug and poisons trust in the core mechanic — a correctness requirement, not polish.

**Graybox map** (Appendix C): 600 m × 600 m, 16v16, classic two-lane-plus-center topology:

```
        NORTH LANE
  [US BASE]──(A)─────(B)
      │       │    ╲   │
      │       │    (C) │        C = center, elevated,
      │       │    ╱   │            hard to hold
      └──────(D)─────(E)──[OP BASE]
        SOUTH LANE
```

- Uncapturable home bases at diagonal corners (NW/SE) with soft "main protection" zones the enemy can't enter.
- **A & E — "front porch" CPs**: ~120 m from each home base; losing your porch flag is recoverable but embarrassing.
- **B & D — lane anchors**: mid-lane, medium cover, 25 m radius; these flip most often — the front line lives here.
- **C — center**: elevated, small 18 m radius, sightlines into both lanes but exposed to both; holding C + your lane = 3/5 flags = enemy bleeds. Deliberately the hardest flag to hold.
- **Travel-time targets**: adjacent CPs 25–35 s on foot, making the squad-leader spawn worth ~30 s per death saved; the transport truck cuts cross-map (base→far lane) from ~90 s to ~35 s.
- **Graybox pass contents (Phase 1)**: terrain heightmap, CP capture volumes, ~40 cover primitives per lane at crouch/stand heights, two elevation changes per lane, spawn clusters (4–6 points per CP, facing cover, ≥8 m from the flagpole). No art; each CP silhouette identifiable at 200 m.

**Playtest instrumentation**: death heatmaps, per-CP flip counts, squad-spawn locations, time-to-first-contact from each spawn cluster. The lattice succeeds if B/D flip 3–4× as often as A/E and C changes hands most of all.
