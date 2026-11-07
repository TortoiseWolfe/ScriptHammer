# Kids' music game — contest brief (round 1, Jonathan, Nov 7, 2026 ~12:40 AM ET)

Team: Jonathan, Shelly (Michelle Evans), Linda, Mindy. Shelly brought the contest.
Source of notes: Jonathan's voice briefing in the networking lane, Nov 7. More rounds coming.

## The contest (researched Nov 7 — Base44 × Nitro Web Game Contest)
- Nitro (Overwolf) × Base44 web game contest, announced Nov 5, 2026. Rules: nitropay.com/base44webgame
- Submissions open Nov 5 → **close Dec 3, 2026**; winners announced Dec 10, 2026.
- Prizes: $65,000 total. Judging panel $50,000: **1st $25,000**, 2nd $10,000, 3rd $5,000, 10 × $1,000. Community Favorite $15,000 by public vote on Base44 Launchpad: 1st $5,000 + 10 × $1,000. A game can win in both pools. Top games featured in the Overwolf App Store.
- Judged on: Gameplay, Creativity, Technical Execution. Judges: Maor Shlomo (Base44 CEO), Uri Marchand (Overwolf CEO), Cody Bye (Nitro founder).
- **Hard requirements: built with Base44, original game, free to play, hosted on a Base44 URL, playable in a browser with NO downloads and NO logins. One original game per participant.**
- Spec consequence: the contest build lives on Base44 — the existing Chattanooga 3D work cannot be submitted as-is. The tight-scope riverfront version is the contest build; the full-city version remains the long-run port target outside the contest.

## Map scope (Jonathan)
- The whole-city Chattanooga build loads too slowly, and the game only needs a small section.
- **Fork it for the contest: tight radius around downtown / the riverfront, SOUTH shore side (not North Shore), around the bridges.** A little explorable downtown, no suburbs, not the whole map.
- Jonathan's earlier push was bigger-bigger-bigger (all of Chattanooga); the contest version deliberately reverses that for load speed. Exact radius still TBD.
- Long run: may port back to the full city after the contest.

## The game (Jonathan)
A kids' game that teaches kids about music by making it fun — the band's production board as a game.

### Soundboard
- One channel per band instrument / member. Each channel opens into a beatbox-style programmer for that instrument.
- Difficulty gradient: Crash (drums) is the easy starter; melodic instruments (e.g. trumpet) get programmable parts too.
- The show starts with a full album pre-programmed on the soundboard — every track, every musician.
- Kids can open the track for a particular instrument and rearrange that instrument's part per song — arrangement-level editing, sheet-music-like depending on the instrument.

### Light board (Shelly's domain)
- The FIRST light kids control is the sun. Natural sunlight is the baseline.
- The sun gets the standard controls any light in the rig has: how fast it sets, color, angle, brightness/dim; it can even be made a narrow-beam spotlight.
- Default pacing: the sun arcs so it sets behind the stage over a ~two-hour show, paced to the music by default (may run faster than real time depending on start point, show length, and set point) — all paced together unless the kids change it. Kids can make the sun set faster or slower.
- Later, kids unlock the rest of the show's lights; Shelly designs the lighting rig.
- Shelly likes the Hog 4 console — that's a brand name; keep the board's controls generic (no Hog 4 branding) unless a sponsorship sign-off ever happens.

## Team roles / prize split — OPEN
- If a prize (e.g. the $25,000 grand prize) splits four ways, responsibilities should be delegated and known up front.
- Shelly: lighting / light design (settled).
- **Linda's and Mindy's contributions: unknown.** Jonathan doesn't know what Shelly has in mind for them; ask Shelly (diplomatically) — natural moment: the Discord side conversation today, Sat Nov 7 at 3 PM, which Jonathan already accepted.
- One entry per participant under the contest rules — whose Base44 account enters, and how a team entry is structured, needs checking in the full rules before building.

## Still open
- Exact map radius for the riverfront fork.
- Linda / Mindy roles.
- Entrant account + team structure under the official rules.
- More briefing rounds from Jonathan to come.

## Base44 account (created Nov 7, 2026 ~12:46 AM ET, Jonathan's order)
- Signed up via Continue with Google as jonpohlner@gmail.com. Workspace: "Turtle's Workspace", 1 member. Dark theme set.
- FREE plan: 25 message credits/month, **5 message credits/day cap**, 100 integration credits; credits renew Dec 1, 2026.
- No apps created yet. No plan purchased, no card entered.
- Workflow constraint to solve: 5 prompts/day on free is thin for building a whole game. The Builder plan ($40/mo) both raises limits and unlocks two-way GitHub sync — one decision, Jonathan's call, not yet made.
