# ScriptHammer as a Federating Community Platform — Candidacy Design Spec (Draft v0.1)

**Author:** Jonathan "TurtleWolfe" Pohlner / ScriptHammer
**Status:** Draft v0.1 — decision tool, not a mandate
**Date:** 2026-07-18

> This document exists to help a decision get made honestly, not to justify one already made. Where the evidence points away from building, it says so plainly. The recommendation at the end is a decouple-and-adopt call, and the sections that argue against building are written to be persuasive on their own terms — because if the build survives them, it deserves to.

---

## 1. Overview & thesis

The real question is not "can ScriptHammer become a federating community platform?" — technically almost anything can be built. The real question is: **should the Chattanooga co-op's near-term community need be met by building a forum + fediverse engine on ScriptHammer, or by adopting mature software (Discourse / Friendica) and spending ScriptHammer's scarce build budget on the one thing that is genuinely non-commodity — the place-anchored digital twin?** The honest finding of the underlying audits is that ScriptHammer has a real, production-grade _data plane_ (E2E group messaging, a dual-implemented RLS authorization contract, a live admin/audit shell, a persistent .NET backend, and a shipped 3D city twin) that meaningfully shrinks the _first third_ of a forum build — and essentially nothing that shrinks the schedule-dominant two thirds (the self-governance triad, email deliverability, and, for federation, an open-ended trust-safety product). A full forum+fediverse platform is a **~32–44 person-month, multi-year** commitment whose hardest parts get ~0 help from existing assets. Discourse+Friendica self-hosted on infrastructure the org already runs is **live in weeks**, with the CVE/interop/trust-safety risk borne upstream. The differentiator (the twin) integrates as an _embed_ against Discourse just as well as against a bespoke engine — so it does not, by itself, justify the build.

---

## 2. Context — ScriptHammer's actual current state

The "static PWA template" impression is outdated. ScriptHammer is a shipping product with several production subsystems that are directly relevant to this candidacy. Correcting the record matters because both the pro-build and anti-build cases depend on what actually exists.

| Subsystem                                 | Verified state                                                                                                                                                                                                                                                                                                                                      | Relevance                                                                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **E2E group messaging + RLS contract**    | Production. Zero-knowledge 1:1 DMs (PRP-023) + group chat (Feature 010). Gap-free per-conversation `sequence_number` (advisory-lock trigger), owner/member roster with succession, C1–C29 authorization contract enforced by ~75 RLS policies.                                                                                                      | The data plane maps closely onto sequence-ordered forum posts. **Encryption sits ABOVE the provider seam — cleanly removable**, leaving a reusable plaintext data plane.                                     |
| **Moderation / admin / audit**            | Auth is production-grade (email/password + GitHub/Google OAuth). Admin dashboard is a **read-only observability shell** — every admin RPC/RLS is `SELECT`; **zero mutation, zero action buttons**. `is_admin()` live-authority pattern (#240), append-only `auth_audit_logs`, rate-limit + credential-stuffing primitives.                          | Auth + audit + rate-limit + admin-shell are strong foundations. **Every actual moderation lever must be built.** Role model is a single binary `is_admin` boolean. No first-party UGC content model exists.  |
| **Enterprise .NET backend (#265 / #280)** | Real persistent ASP.NET Core 8 + EF Core + Kestrel server re-expressing the C1–C29 contract in C#. Already fetches/caches remote JWKS and validates ES256 (asymmetric-crypto-over-HTTP machinery exists). **Dev-only**: `127.0.0.1:5099`, no CI, no prod compose, no hostname/TLS, partial (message+conversation core only), unverified end-to-end. | Architecturally the **best home** for any server endpoint (root-path routing free; adjacent to HTTP Signatures). The static frontend can **never** host a server. Deployment is the blocker, not capability. |
| **Chattanooga 3D digital twin**           | Production, live at `scripthammer.com/chatt`, in nav as "3D Map". 8,031 buildings on a Cesium georeferenced globe + a Three.js tilt-shift diorama, over one reproducible offline bake pipeline that can scaffold **any** city. `pick()` returns `AtlasPickId {OSM wayId, address, tags}` per building click.                                        | The single non-commodity asset. The exact join key a place-based forum needs already exists. The twin↔forum join is **not built** (separate stacks).                                                        |

**Net correction:** ScriptHammer is a live product with a genuine backend track and a differentiating geospatial asset — not a static toy. But "has a strong data plane and a server home" is not "has a forum" or "has a federating server." The gap is concentrated in exactly the parts that are hardest and never finished.

---

## 3. The three scopes

### Option 2 — Full forum + fediverse platform (PRIMARY)

Build a public, world-readable member forum on ScriptHammer's data plane, then federate it. Requires inverting the closed C7 participant-only RLS to world-readable, dropping the encryption layer for the public variant, building the entire UGC content model + categories + the self-governance triad + email + search, then adding a full ActivityPub server (Tier-1 publisher **and** Tier-2 inbound federation) on the deployed .NET backend, plus a permanent federated trust-safety function. **Honest estimate: ~32–44 pm to a credible v1; Phases 6–7 get ~0 reuse; Phase 7 never terminates.** This is the ambition the title implies and the primary object of this spec's scrutiny.

### Option 1 — Tier-1 fediverse publisher (BOUNDED)

Make Chattanooga.Digital a single followable `Service`/`Application` actor (`@chattanooga@chattanooga.digital`) that **publishes announcements + events outbound**. Deliverables: deploy the .NET backend to real infra with hostname+TLS; actor doc + WebFinger + NodeInfo + outbox `OrderedCollection` (`sequence_number` is the natural ordering key); RSA/Ed25519 keypair + HTTP-Signature **signing**; the unavoidable minimal inbox (receive `Follow`/`Undo(Follow)`, verify signature, reply `Accept`, track followers, retrying fan-out) driven off the near-1:1 `user_connections` state machine. **Explicitly out of scope:** no inbound content ingestion, no `Create/Note` handling, no cross-instance threading, no LD-signatures, no federated moderation product. **Estimate: ~2–4 pm.** Honest caveat: "outbound-only" is a mirage — to be followable you _must_ run the signature-verifying inbox + fan-out, importing a miniature of Tier-2's hard machinery, and the deploy-the-server prerequisite is real.

### Option 3 — Build vs. buy (ADOPT Discourse / Friendica)

Self-host **Discourse** for the member forum and **Friendica** (or Mastodon) for fediverse presence — both as containers on the Docker/Swarm/Traefik/Portainer infra the org already runs in production for Chattanooga.Digital. Keep ScriptHammer's E2E messaging for private member channels (genuinely better than Discourse PMs). Wire the twin↔forum place-join as an **embed + deep-link** against Discourse's mature embed+SSO+REST API on the `AtlasPickId` join key. **Live in weeks.** Upstream bears protocol/CVE/interop/trust-safety risk.

---

## 4. Gap matrix

Effort in person-months (pm). "Iceberg" = capability teams routinely under-scope.

| Requirement                                                         | ScriptHammer has                                                                                                               | Gap                                                                                                                                                                                                                        | Effort                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Forum: topics/threads + read-state**                              | Strong: `sequence_number` = sequence-ordered posts; virtualized WCAG-tested thread UI ≈ Discourse single-stream view           | No topic container above conversation; no per-user read position/unread; flat only (no `parent_post_id`)                                                                                                                   | 1.5–2.5               |
| **Forum: categories + per-category ACL**                            | Nothing direct; RLS/`is_conversation_member` discipline as pattern                                                             | Whole taxonomy + groups×read/reply/create/moderate matrix; search/notify must honor it                                                                                                                                     | 2–3                   |
| **Forum: public world-readable posts**                              | Decisive: encryption is removable above the provider seam                                                                      | Invert C7 participant-only RLS to world-readable; drop encryption for public variant                                                                                                                                       | 1–2                   |
| **Forum: replies + quoting**                                        | Flat linear sequence; edit/soft-delete contract                                                                                | Reply-to indicators, quote-back; nested tree greenfield                                                                                                                                                                    | 0.5–1 (+2 nested)     |
| **Forum: rich composer (ICEBERG)**                                  | Plaintext composer + offline draft/queue idempotency                                                                           | Upload pipeline (resize, file-type validation, **SVG-XSS + decompression-bomb sanitization**), @mention, onebox (**SSRF**). Highest per-feature blast radius                                                               | 3–4                   |
| **Forum: notifications (ICEBERG)**                                  | `useUnreadCount`, ACL-safe refetch model, retry queue                                                                          | Typed store, per-user digest intelligence, frequency prefs, reply-by-email                                                                                                                                                 | 3–4                   |
| **Forum: full-text search (ICEBERG)**                               | Nothing — encryption actively blocks FTS until removed                                                                         | Ranking, typo tolerance, filters, incremental re-index, **mandatory per-category ACL filtering**                                                                                                                           | 3–4                   |
| **Forum: trust levels (ICEBERG)**                                   | Binary `is_admin` + extensible `is_admin()`                                                                                    | TL0–TL4 auto-promotion engine; generalize to `has_role(scope)` over a roles table                                                                                                                                          | 3–4                   |
| **Forum: flagging + moderation (ICEBERG)**                          | Admin _shell_ reusable; append-only audit write pattern; rate-limit primitive. **Every admin RPC/RLS read-only**               | Flag types, review queue, auto-hide, mod actions (hide/delete/silence/suspend/ban), audit trail (actor→target→reason), appeals — all net-new mutation RPCs + write RLS                                                     | 4–5                   |
| **Forum: spam/abuse (ICEBERG, never done)**                         | Rate-limit + credential-stuffing detector patterns                                                                             | New-user restrictions coupled to trust levels, honeypots/CAPTCHA, content scoring, blocklists                                                                                                                              | 3–5 + permanent       |
| **Forum: auth + onboarding**                                        | Production-grade auth; idempotent welcome-service                                                                              | Low-friction first post, guided tour, progressive disclosure                                                                                                                                                               | 1–2                   |
| **Forum: email deliverability (ICEBERG)**                           | Admin email panel + SMTP plumbing (thin)                                                                                       | SPF/DKIM/DMARC, IP warmup, bounce/complaint, List-Unsubscribe, digest split, inbound reply-by-email                                                                                                                        | 2–4 + ongoing         |
| **Forum: a11y (dynamic) + PWA push**                                | Strong: WCAG-tested atomic components; PWA                                                                                     | a11y for new dynamic surfaces; web push infra (VAPID, iOS-Safari PWA push)                                                                                                                                                 | 2–3                   |
| **Fedi T1: actor + WebFinger + NodeInfo + outbox**                  | 3 conceptual head-starts only (`user_profiles`≈actor, `sequence_number`≈ordering, `user_connections`≈Follow). **Zero AP code** | All endpoints greenfield + JSON-LD `@context` + content-negotiation + permanent dereferenceable IDs. Needs a server home                                                                                                   | 1.5–2.5               |
| **Fedi T1: HTTP-Sig signing + keypair + minimal inbox**             | .NET already does asymmetric-over-HTTP; `user_connections`≈Follow state machine                                                | **CRITICAL MISMATCH: existing keys are ECDH message keys, NOT RSA/Ed25519 signing keys.** Keypair gen/storage/publication, signing, the "Tier-1 mirage" verifying inbox + fan-out                                          | 2–3                   |
| **Fedi T2: inbox ingestion + sig VERIFY + object AUTH (CVE-class)** | RLS discipline + idempotency (conceptual, client-side)                                                                         | Dedupe-by-activity-id; sig verify (remote key fetch = **SSRF**, Digest-vs-body, clock-skew, blind key rotation, RFC 9421 vs draft); **authorization gap** (signature proves _who_, not _may they_ Delete/Update/attribute) | 4–6                   |
| **Fedi T2: deref (SSRF) + threading + LD-sig + delivery worker**    | Client-side offline outbox is a _conceptual_ analog only; **no IHostedService/queue exists**                                   | SSRF-hardened fetch; ancestor backfill + tree reconstruction; **LD Signatures / URDNA2015 RDF canonicalization**; durable retrying fan-out at scale                                                                        | 6–9                   |
| **Fedi T2: forum-as-GROUP + interop matrix**                        | `conversations`/roster (conceptual only)                                                                                       | **Lemmy Group-actor Announce-wrap model** (NOT Mastodon person-to-person); live-peer interop matrix, continuous                                                                                                            | 3–5 + ongoing         |
| **Fedi T2: federated MODERATION + ANTI-ABUSE**                      | **NOTHING** — only a personal 1:1 contact block                                                                                | Domain/actor blocklists + defederation; inbound spam at internet scale; **CSAM custodial + mandated reporting**; not-becoming-a-vector; cross-instance Flag handling                                                       | 6+ then **PERMANENT** |
| **Backend HOST (binding constraint)**                               | Real .NET server exists; org runs Swarm/Traefik/Portainer in prod                                                              | .NET is dev-only/partial/unverified; static frontend can **never** host it. Deployment is the blocker                                                                                                                      | 1.5–3                 |

---

## 5. Phased roadmap for Option 2 + honest estimates

| Phase                                                            | Scope                                                                                                                                                                                                                                                                                                                                      | Estimate                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **1 — Plaintext forum data plane**                               | Strip removable encryption above the provider seam; invert C7 to world-readable; build posts/threads/categories UGC model + per-category ACL on proven RLS discipline; reuse `sequence_number` ordering + virtualized thread UI verbatim                                                                                                   | ~3 pm                         |
| **2 — Forum UX + composer/search/notify icebergs**               | Rich composer with upload/sanitization/onebox hardening (stored-XSS + SSRF — highest blast radius); ACL-aware FTS with re-indexing; typed in-app + email notification store; flat reply/quote                                                                                                                                              | ~4–5 pm                       |
| **3 — Self-governance triad**                                    | Generalize binary `is_admin()` into trust-level/`has_role(scope)` engine; flagging + moderation review queue + missing mutation RPCs/write RLS + actor→target→reason audit trail; wire action affordances into read-only admin shell; spam/abuse defense on rate-limit primitive                                                           | ~5–6 pm                       |
| **4 — Operational hardening → standalone Discourse-class forum** | Email deliverability (SPF/DKIM/DMARC, warmup, bounces, List-Unsubscribe, digest intelligence, reply-by-email); non-technical onboarding + welcome bot; dynamic-app WCAG AA; PWA web push. **End of forum track.**                                                                                                                          | ~3–4 pm                       |
| **5 — Deploy server home + Fediverse Tier-1 publisher**          | Promote dev-only .NET backend onto KDG Swarm/Traefik/Portainer (hostname+TLS, verify end-to-end first); actor + WebFinger + NodeInfo + outbox + RSA/Ed25519 keypair + HTTP-Sig signing + minimal Follow/Accept inbox off `user_connections`                                                                                                | ~3–4 pm                       |
| **6 — Fediverse Tier-2 inbound federation**                      | Full inbox ingestion + sig VERIFY (SSRF-safe key fetch, Digest, replay window) + object AUTH model + SSRF-hardened deref + cross-instance threading/backfill + LD-sig/URDNA2015 + durable retrying delivery worker (net-new IHostedService) + Lemmy Group-actor model + live-peer interop matrix. **The protocol code is the SMALL part.** | ~10–14 pm                     |
| **7 — Federated trust-safety, NEVER done**                       | Domain/actor blocklists + defederation; inbound spam at internet scale; CSAM scanning/quarantine + mandated reporting (legal custodial duty the instant you accept federated media); not-becoming-a-vector controls; cross-instance Flag handling. **Standing product + staffing cost, not a line item.**                                  | ~6 pm initial, then permanent |

**Honest total:** ~32–44 pm for a small team (2–4 devs) to a credible v1 — roughly ~15–18 pm forum (1–4), ~3–4 pm Tier-1 (5), ~15–20 pm Tier-2 + trust-safety (6–7). The caveat that makes the number honest: **Phase 7 does not terminate** — it converts into permanent operational staffing. True total is "v1 in ~3 years for a 2–3 person team, then ongoing." Existing assets genuinely shrink Phases 1–5; **nothing shrinks 6–7.**

**Schedule-dominant risks (in order):**

1. **Federated moderation + anti-abuse is the schedule-dominant, open-ended risk and gets ~0 help from any asset.** The instant you accept federated media you become the legal custodian of CSAM you never solicited (18 U.S.C. §2258A / NCMEC-style reporting duties). Emit abuse once and you are blanket-defederated with no appeal. This is a **trust-safety product**, not a feature.
2. **Interop is "whatever Mastodon/Lemmy actually do," verified against live peers** — continuous, unbudgetable. A forum must federate as Lemmy's Group actor; build against the microblog model and you "sign correctly but don't interoperate."
3. **Signature-VERIFICATION + object-AUTHORIZATION is a recurring CVE class** (a valid signature proves _who_, not _what they may do_). Miss the ownership/`attributedTo`/origin-domain checks and anyone deletes or forges anyone's content.
4. **LD-signatures / URDNA2015 RDF canonicalization** is hard crypto almost everyone skips; cross-instance threading breaks without it.
5. **The .NET backend is undeployed, partial, and unverified** — the whole fediverse track is gated on standing it up first; the static frontend can never host it.
6. **Email deliverability** is a documented ops sinkhole.
7. **The rich-composer upload/onebox path** is the highest per-feature security blast radius (stored XSS, SSRF).

---

## 6. The Chattanooga digital-twin differentiator

The twin is the **single genuinely differentiating asset** in the whole program — and it moves the needle in a counterintuitive direction: **it raises the value of _adopting_ commodity forum/fediverse software rather than building it.**

- **It is real and production-grade.** 8,031 buildings on a Cesium georeferenced globe over a reproducible offline bake pipeline that scaffolds any city; live in nav; E2E-tested behind a WebGL probe.
- **It is the one hook a place-based community can offer that generic Discourse/Hubzilla/Friendica structurally cannot:** conversation anchored to the actual city — click your block, land in its thread.
- **Critically, that hook is delivered by an embed + deep-link, not by owning the forum engine.** `pick()` already returns `AtlasPickId` (OSM wayId, address, tags) — the exact join key an integration needs — and Discourse ships a mature embed + SSO + REST API to receive it. **The twin integrates against Discourse just as well as against a bespoke ScriptHammer forum**, which decouples the differentiator from the platform decision entirely.

**Honest status:** the twin↔forum join is **not built today** (separate stacks). It is an opportunity resting on a mature, portable asset — roughly **1–2 pm to wire against Discourse** vs. the **30+ pm** of building a platform to host it. The "playable city" civic layer (Model City sim, Civic League missions, equity-weighted city score) is explicitly an AI-mocked brainstorm; only the read-only twin plus a live AQI reading actually exist. The marketing line "8,000 buildings at real lidar heights" is a simplification — 8,031 draw, but only ~1,510 carry baked heights (1,328 lidar-measured); the rest get heuristic heights.

**Net:** the twin is a real, durable, reproducible moat — but it is a moat around **PLACE, not around forum/federation plumbing.** It is the only non-commodity value in the program and the reason CD's community can be something Discourse-anywhere is not. It argues for **buying the commodity layer and spending scarce build budget on the place-join**, not for building the engine to host it.

---

## 7. The kill-case

This section carries the adversarial arguments at full strength. A serious reviewer should be able to read _only_ this section and understand why "build" is the harder position to defend. Two independent reviews reached a KILL verdict; one reached a heavily-fenced qualified-yes. All three are represented.

### 7.1 Opportunity cost is decisive and asymmetric

The build's own honest estimate is ~32–44 pm — "v1 in ~3 years for a 2–3 person team, then ongoing." Even the narrowest defensible slice (Option 1) "imports most of Tier-2's hard machinery in miniature." Adopting Discourse is live in weeks, on the exact Docker/Swarm/Traefik/Portainer stack the org already runs. Every one of those 30–44 months re-implements solved problems to reach parity with free, self-hostable software. Because the twin place-join needs the same `AtlasPickId` key either way and is ~1–2 pm against Discourse, **building the engine buys zero differentiation.**

### 7.2 Discourse's lead is in exactly the parts ScriptHammer lacks

ScriptHammer's genuine reuse is the messaging data plane (Phase 1 and parts of 4). What _dominates_ the schedule is the self-governance triad — TL0–TL4 trust levels, flag/review/moderation queue with real mutation levers, adversarial spam defense — plus ACL-aware search, typed notifications, and email. On every one of these the audit records ScriptHammer as having "only shells and primitives, not the levers" — **"EVERY admin RPC/RLS is read-only — zero mutation, zero action buttons."** Re-deriving Discourse's spam heuristics, upload sanitization, and trust engine is starting the hardest 60% from zero while inheriting the CVE liability forever.

### 7.3 The moderation-liability case (both reviewers led with this)

The instant a federated inbox accepts media it never solicited, the operator becomes a **legal custodian**: US law (18 U.S.C. §2258A) obligates NCMEC reporting on actual knowledge of apparent CSAM; EU operators face DSA-adjacent duties. Discharging it requires hash-matching, quarantine pipelines, a designated reporting contact, evidence-preservation, and someone on call. The audit confirms this surface gets **zero** help from any existing asset. Handing that duty to volunteer non-technical co-op members is not a staffing gap — it is negligence exposure. Compounding risks:

- **Reputation is a binary hostage.** Emit abuse once (compromised account, open relay, spam wave) and larger instances blanket-defederate your domain quietly, with no appeal. Members are then told they are "connected" when no one receives them — worse than nothing.
- **GDPR/erasure becomes unsatisfiable once data federates out.** You emit a `Delete`, but remote caches mostly never process it. The co-op's own tagline is "sophisticated websites you control" — federation structurally prevents keeping that promise.
- **Remote dereferencing is an SSRF surface pointed at your own infra.** Verifying an inbound signature and resolving `inReplyTo` require server-initiated fetches of attacker-supplied URLs — a lateral-movement vector against the same production Swarm that runs Chattanooga.Digital's live Drupal estate.
- **Tier-1-only narrows but does not eliminate the blast radius:** to be followable you must run a signature-verifying inbox + retrying fan-out, reintroducing SSRF, spam-ingress, and erasure obligations in miniature.

### 7.4 The inbound authorization gap is a recurring CVE class — and the "reusable" crypto is the wrong key

A valid HTTP Signature proves _who_ sent an activity, not that they _may_ Delete/Update/attribute the target. The Mastodon/Pleroma CVE history is full of forged-Delete/Update and impersonation bugs from exactly this gap. Worse, the reassuring "we already do asymmetric crypto" story does not transfer: ScriptHammer's `user_encryption_keys` are **ECDH message keys, not the RSA/Ed25519 signing keys AP needs.** The one asset that looks reusable for federation isn't.

### 7.5 Founder conflict of interest — stated explicitly because a client must hear it

ScriptHammer is not neutral infrastructure the co-op happened to choose. Per the workspace constitution it is "the seed of a 5-track family" — the contractor's **own open-source product line**, whose templates are meant to be extracted _from_ shipped apps. Steering a non-technical client onto the contractor's own OSS project creates a structural incentive to (a) prefer build over buy because the build grows the contractor's flagship, (b) bill the multi-year implementation, and (c) bill the **permanent** trust-safety staffing the audit says never terminates. The recommendation that maximizes the _client's_ interest (adopt commodity software, spend 1–2 pm on the twin place-join) is the one that minimizes the _contractor's_ billable footprint. The clean tell: the only pro-build argument is the twin, and the audit itself proves the twin integrates against Discourse identically — decoupling the differentiator from the platform decision. When the sole pro-build rationale collapses on inspection and the remainder is "reuse the contractor's messaging code," the burden is on the contractor to show this is not self-dealing. A disinterested advisor recommends adopt.

### 7.6 The build does not even have a home yet

The entire fediverse track is gated on a .NET backend that is dev-only (`127.0.0.1:5099`, no CI, no prod compose, no hostname/TLS, unverified end-to-end, partial). The static frontend "can NEVER host the server." So "build" means: first deploy and harden an undeployed partial server (1.5–3 pm), _then_ start the 30+ pm on top. Adopt has no such prerequisite — Discourse drops onto the existing Swarm as a container.

### 7.7 What would flip the kill-case toward build

A build becomes defensible only if **all** of these hold: (1) the co-op's near-term need is decoupled from the build — members ship on adopted Discourse+Friendica in parallel, not waiting on it; (2) a **funded, named trust-safety owner with a written CSAM/NCMEC runbook and hash-matching exists before any inbound activity is accepted**; (3) scope stays fenced at a Tier-1 publisher whose inbox handles only `Follow`/`Undo` and hard-rejects all inbound content, deployed network-isolated from the Chattanooga.Digital production stack; and (4) an independent advisor with no stake in ScriptHammer, shown the same gap matrix, still recommends build. Absent all four, **adopt dominates on cost, risk, time-to-value, and conflict-of-interest grounds.**

---

## 8. Decision criteria + recommendation

### Decision criteria

| Axis                                    | Adopt (Discourse/Friendica)        | Build (Option 2)                            |
| --------------------------------------- | ---------------------------------- | ------------------------------------------- |
| Time-to-value for co-op's forum need    | Weeks                              | ~3 years to v1                              |
| Cost                                    | Low (self-host on existing Swarm)  | ~32–44 pm + permanent staffing              |
| Who bears CVE/interop/trust-safety risk | Upstream, battle-tested            | Co-op, forever                              |
| CSAM custodial + legal duty             | Upstream-mediated / avoidable      | Co-op owns it the moment media federates in |
| Differentiation gained by building      | **Zero** (twin embeds identically) | Zero                                        |
| Ops fit (no-Amazon, self-host ethos)    | Yes                                | Yes, but must first deploy a partial server |
| Conflict-of-interest posture            | Neutral                            | Contractor's own flagship                   |

### Recommendation — decouple

1. **For the co-op's near-term need: ADOPT.** Self-host **Discourse** for the member forum now (weeks, on existing Swarm/Traefik/Portainer, no-Amazon). Add **Friendica** (or Mastodon) only if a genuine fediverse presence is actually wanted, so upstream carries the security/interop/trust-safety burden. Do **not** build the forum/fediverse engine on ScriptHammer for the co-op's must-work-now requirement.
2. **Spend the saved budget on the moat: the twin↔forum place-join** (~1–2 pm) wired as an embed + deep-link against Discourse's embed+SSO+REST API on the `AtlasPickId` key. This is the only non-commodity value and is platform-independent by design.
3. **Keep ScriptHammer's E2E messaging** for private, provider-un-readable member channels — genuinely better than Discourse PMs and the one place the encryption layer is an asset rather than a blocker.
4. **ScriptHammer's real, defensible fediverse bet is Option 1, not Option 2** — a **fenced Tier-1 publisher** on the deployed .NET backend, advancing enterprise-readiness epic #280. Pursue it as a ScriptHammer product/proving-ground investment **only if** decoupled from the co-op timeline, staffed by a 2–3+ dev team, fenced at the publisher, and gated behind a named abuse-response owner. It is a legitimate ~2–4 pm bet that plants a fediverse flag and exercises the deploy path without owning a two-way federation product.
5. **Gate Option 2 explicitly behind §7.7's four conditions.** Full Tier-2 inbound federation on home-grown code is not appropriate for a non-technical co-op and should be **declined** unless those conditions are met and independently reviewed. The recommendation is deliberately "buy the plumbing, build the moat" — not "build the platform."

---

## 9. Open questions

1. **What is Greg's actual requirement** — "members want a private, members-only discussion space," or "we want to be part of the wider fediverse"? If the former, federation is out of scope entirely and the whole trust-safety surface evaporates (Discourse, or even ScriptHammer's E2E DMs, answers it with zero federation).
2. **Is there a funded, named human accountable for abuse/CSAM response** with a written NCMEC runbook and hash-matching _before_ any inbound activity is accepted? Without this, no inbound federation is permissible.
3. **Can the .NET backend be deployed network-isolated** from the Chattanooga.Digital production Swarm, so a federation SSRF bug cannot pivot into the client's live Drupal estate?
4. **Is the co-op's forum need decoupled** from any ScriptHammer build — i.e., can Discourse ship in parallel so members are never waiting on a multi-year platform?
5. **Does an independent advisor with no stake in ScriptHammer**, shown this gap matrix, concur? Given the §7.5 conflict, this is a governance requirement, not a nicety.
6. **Member-consent + data-flow disclosure:** do members understand that federated posts leave the co-op's control and that erasure is best-effort across remote instances?
7. **Is the twin place-join worth funding on its own** (~1–2 pm) regardless of the forum decision? The audit suggests yes — it is the only durable, non-commodity asset — and it should likely proceed independent of everything above.
8. **Which forum engine best receives the twin embed** — Discourse (mature embed+SSO+REST, recommended) vs. Friendica/Hubzilla (no native place primitive; embed-only iframe)? This determines the place-join's ceiling.
