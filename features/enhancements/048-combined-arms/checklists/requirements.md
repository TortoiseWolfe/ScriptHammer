# Specification Quality Checklist: COMBINED ARMS

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-09
**Feature**: [spec.md](../spec.md) · **Tickets**: [tasks.md](../tasks.md) · **PRD**: `combined-arms-prd.md` (repo root, Draft v0.1)

## Spec Completeness

- [x] Every pillar requirement (SQ-1…SQ-6, VC-1…VC-6, CQ-1…CQ-6) has at least one acceptance scenario in US1–US5 AND at least one ticket in tasks.md (traceability: SQ → T022/T023/T030/T033; VC → T029–T032 + VC-6 in Out of Scope; CQ → T015–T021/T034/T039)
- [x] Supporting requirements (FR-001…FR-006) and non-functional requirements (NFR-001…NFR-009) each map to a ticket with a testable acceptance criterion (FR → T013–T015/T024–T026/T038; NFR → T002–T008/T012/T029/T036/T037/T042/T043)
- [x] Success criteria are measurable — SC-001…SC-011 all carry quantitative targets; T040/T041 ticket the instrumentation + dashboards that compute them
- [x] Appendix B tuning math is an executable spec, not prose — capture table (T016), ticket/bleed model + 20-minute B.3 sanity simulation (T018) are unit-test fixtures
- [x] Out of Scope is explicit: jets/helis/armor, commander at MVP, ranked/unlocks/persistence, console/native, destruction, proximity voice (VC-6), monetization (deferred per Clarifications)
- [x] Edge cases identified (leader disconnect during denial, flip-boundary contention, WebTransport blocked, SFU unreachable, full squads, spawn-protection abuse, ticket-race tie) and ticketed where behavioral (T019, T022, T023, T030)
- [x] No [NEEDS CLARIFICATION] markers remain — 5 clarification Q&As encoded (map, player count, monetization, lone wolf, SQ-4 visibility)
- [x] Dependencies and assumptions sections present (bake pipeline #232/#229, WebTransport Baseline, Node/TS viability with Rust escape hatch, hosted server infrastructure)

## Feature Readiness

- [x] User scenarios cover the three pillars and their interlock: US1 (Conquest loop + atomic flip), US2 (leader spawn + combat denial), US3 (squad voice + command net), US4 (classes + zero-ticket revive), US5 (transport + 32v32 scale)
- [x] Priorities assigned and phase-aligned: P1 = US1/US2 (Phase 1 vertical slice), P2 = US3/US4 (Phase 2 social layer), P3 = US5 (Phase 3 breadth)
- [x] Each user story has an Independent Test that a later session can execute without the other stories shipped
- [x] Phase gating mirrors PRD §7 exactly: Phase 0 spike → kill criterion → vertical slice → social layer → breadth; tasks.md encodes the gate as T012 with explicit DEPENDS on every downstream ticket
- [x] Key entities defined (Squad, Control Point, Ticket Pool, Match, Player, Site Config) and each is owned by a named server module in tasks.md

## Constitution v1.0.2 Gates

- [x] Wireframe gate (Principle III): `wireframes/01-deploy-screen.svg`, `02-squad-hud.svg`, `03-scoreboard-tickets.svg` authored 2026-07-09, validator PASS (`.specify/extensions/wireframe/scripts/validate.py`), referenced from spec.md `## UI Mockup`. Human `/speckit.wireframe.review` sign-off remains open for the implementation session.
  - [x] 01-deploy-screen anchors US-001, US-002, CQ-3, CQ-5, SQ-2, SQ-4 (both combat-denial variants rendered)
  - [x] 02-squad-hud anchors US-002, US-003, SQ-5, SQ-6, VC-4, CQ-2 (roster, speaking indicators, order marker, capture meter)
  - [x] 03-scoreboard-tickets anchors US-001, CQ-4, SC-006 (ticket pools, bleed indicator, CP strip, per-squad grouping)
  - [x] SVG rules honored: 1920×1080 canvas, desktop 1280×720 @ (40,60), mobile 360×720 @ (1360,60), panel color `#e8d4b8`, 44 px touch targets
  - [ ] `.issues.md` audit trails preserved per SVG (never deleted)
- [ ] 5-file component pattern: every UI component ticket (T020, T021, T025, T030, T032, T033, T039) scaffolds via `pnpm run generate:component` — index.tsx / Component.tsx / .test.tsx / .stories.tsx / .accessibility.test.tsx (verified at implement time by `validate:structure`)
- [ ] Docker-first development: match server is a `docker-compose.yml` service (T001); LiveKit SFU is a compose service (T029); all pnpm/test commands run inside containers — no host installs
- [ ] Pa11y accessibility: menu + deploy routes audited (T027); in-match canvas route excluded with documented canvas-not-auditable rationale per the 047 precedent
- [ ] **Static-export constraint respected**: the game server is a **separate deployable** (`game-server/` + hosted infra); ZERO Next.js API routes (`src/app/api/` stays empty); the browser client remains a static GitHub-Pages artifact (spec Implementation Status note; tasks.md path conventions)
- [ ] TDD ordering: math-spec tickets (T016, T018) and netcode tickets carry test-first acceptance criteria; RED-first enforced at implement time

## Netcode Gates

- [x] **Kill criterion defined AND scheduled before any Phase 1 work**: T012 states the gate verbatim — perceived latency acceptable at 100 ms simulated RTT with 16 moving capsules, measured ≤20 KB/s down; NO-GO stops the feature and re-opens platform choice (PRD §7; tasks.md Phase 0 gate)
- [x] Bandwidth budgets stated numerically: ≤20 KB/s down per client at 32 players, ≤40 KB/s at 64 (NFR-001), with the enforcement mechanisms ticketed (delta compression + quantization T003; interest management + priority accumulator T036; validation runs T012/T037)
- [x] Lag-compensation rewind cap stated: 250 ms (NFR-004), with the cap boundary explicitly unit-tested (T008); projectiles forward-simulated, no rewind
- [x] Tick authority stated: 30 Hz fixed tick owns positions, health, capture meters, tickets (NFR-002, T002); atomic spawn-flip `{cpId, newOwner, tick}` on the reliable stream with same-tick queued-spawn invalidation (CQ-3/Appendix B.4, T019)
- [x] Transport degradation path stated: WebTransport primary with datagram/stream split, WebSocket fallback treated identically by the server (NFR-005, T004/T005)

## Clean-Room Gate

- [x] No EA/DICE names, assets, maps, or branding anywhere in spec.md, tasks.md, the PRD, or wireframe filenames — codename **COMBINED ARMS** throughout; "Battlefield 2-inspired" appears only as mechanics-lineage attribution in design rationale, never as product naming
- [x] The map is real Chattanooga geography from open data (digital-twin bake), not a recreation of any BF2 map; the Appendix C lattice is described topologically (lanes/center), not by any DICE map name in requirement text
- [ ] Re-verify at each phase checkpoint (T012, T028, T035, T043): no trademarked names in UI strings, asset filenames, or committed artifacts

## Privacy Gate

- [x] Map footprint is public parkland + commercial streets only (Coolidge Park, Walnut St Bridge landing, Frazier Ave strip, Renaissance Park) — no residential client-parcel data in the box's gameplay data
- [ ] `sites/north-shore.json` + `public/twins/north-shore/` deliberately allowlisted via `!` gitignore entries (T013) per the repo privacy default (`sites/*` gitignored; client-address bakes stay local) — verify `git check-ignore` at bake time
- [ ] No house-level / `house/` bake artifacts committed for this site (repo privacy pattern: `/public/twins/*/house/` stays ignored)

## Open-Questions Ledger (tracked, deliberately unresolved)

- [ ] **Monetization**: deferred entirely (Clarifications; PRD §9) — nothing in spec/tasks depends on it; re-open only as its own future feature
- [ ] **Lone-wolf stance**: "squads are strictly better" is the intended pressure at MVP (lone wolves spawn only at controlled flags, SQ-1); revisit ONLY with playtest evidence from T040/T041 dashboards (SC-002 squad-participation metric is the tripwire)
- [ ] **SQ-4 denial-timer visibility** (visible countdown vs opaque): both variants implemented behind the `denialTimerVisible` server flag (T023), compared via T040 instrumentation — decision lands after playtest data; do NOT remove the flag or pick a winner before then
- [ ] **Free-weekend vs closed-alpha playtest cohort** (PRD §9): operational decision for the Phase 3 playtest program; does not block any ticket

## Workflow Position

- [x] `/speckit.specify` complete (spec.md exists, Draft, 2026-07-09)
- [x] `/speckit.clarify` complete — 5 Q&As encoded in spec.md Clarifications (map, player count, monetization, lone wolf, SQ-4 visibility)
- [x] `/speckit.tasks` complete — this checklist's sibling tasks.md (43 tickets, phase-gated, 2026-07-09)
- [ ] `/speckit.wireframe.prep` → `/speckit.wireframe.generate` → `/speckit.wireframe.review` — NEXT STEP; must PASS before planning
- [ ] `/speckit.plan` — BLOCKED on wireframe sign-off
- [ ] `/speckit.analyze` — cross-artifact consistency after plan lands
- [ ] `/speckit.implement` — future sessions, phase by phase, honoring the T012 kill-criterion gate

## Notes

- Items marked incomplete are either (a) gates that fire later in the workflow (wireframes before `/speckit.plan`; component/Pa11y/static-export verification at implement time) or (b) deliberately open questions with a named resolution mechanism.
- The wireframe gate is the immediate blocker: 01/02/03 must be generated, reviewed, and signed off into spec.md `## UI Mockup` before `/speckit.plan` runs.
- Phase gating is the second structural control: tasks.md T012 (kill criterion) blocks Phases 1–3; treat a NO-GO verdict as a first-class outcome, not a failure to route around.
