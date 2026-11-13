# Kids' game — batched feedback for the NEXT single Base44 prompt

Standing rule (Jonathan, Nov 7, 9:52 AM): NO one-at-a-time feedback prompts. Every
note, nitpick and fix gets logged here and goes into Base44 as ONE batched prompt
(the post-3 PM-meeting round), together with the new game name once picked and
the team's edits.

## Logged so far (Nov 7 morning, from Jonathan looking at the first build)

1. **Aquarium doesn't belong in the scene at all.** The first build put it
   across the river — wrong bank. Final correction (Jonathan, Nov 7, 10:00 AM):
   at the soundboard angle you'd never see the aquarium — it's behind the
   camera, up the bluff on the downtown side. It appears NOWHERE in the game
   view. The far bank is the North Shore: low, tree-covered hills, no
   aquarium, no glass peaks. (This note is already baked into the new Prompt
   Plan's Prompt 1, so it may not need to ride the batch at all.)
2. **Clouds look cheap.** Replace with a realistic golden-hour sky: soft
   gradient, a few soft-edged natural clouds with warm sunlight on them, subtle
   and photographic. No cartoon blobs, no flat white cut-out shapes.

## NEW BUILD — first look at Prompt 1 v2's result (Nov 7, ~1:07 PM, browser-observed)

App: "ScriptHammer: Build the Show", id 6aef664959da5bf44cba19a2, UNPUBLISHED.
Right: real 3D with depth; title + scene only on the page; "Band Wagon" nowhere;
stage close to the photos; bridges on the correct sides (arched bridge left,
blue bridge right); no aquarium or towers anywhere.
Deviations — logged for the batched correction round, NOT patched piecemeal:
1. **The river is not visible anywhere** — the stage's solid back wall blocks
   the view behind it and no water shows at the sides either; the treeline
   flanks the stage instead of reading as the North Shore across water.
2. **An unrequested crowd** of pastel capsule figures fills the whole lawn
   foreground AND the bottom strip that was supposed to stay empty for the
   soundboard panel.
3. **Two giant white spheres with blue rings** float beside the stage (look
   like beach balls) — in no prompt, no photo, nowhere. Remove. Jonathan's
   ruling (Nov 7): maybe they were meant to be the lights or sun orbs — it
   doesn't matter; they dominate the screen and block the view. **Standing
   rule from this: nothing floats in the camera's view or blocks the stage.
   The frame belongs to the stage — lights are fixtures on the stage, the
   sun is a light source, never a visible ball in frame.**
4. **Only 7 robots clearly visible**; the 8th is not clearly in frame (may be
   hidden behind another bot or the crowd). Verify all 8 present and visible.
5. **Sky/light washed out** — pale cream-blue, flat bright light, not the
   golden-hour low warm sun that was specified.
6. Bob animation not confirmable from still frames — check in motion later.

## Jonathan's own look (Nov 7, ~1:15 PM) — "lots to nitpick, but still much
better than the first draft"
7. **The big white balls** on either side of the stage — he saw them too.
   Nobody specified them; they match nothing. Removal already logged (item 3).
8. **We feel really far from the stage.** The camera framing should feel
   closer to the stage.
9. **The far shore is just trees** — not the actual North Shore Chattanooga
   (which has houses/buildings, a lived-in shore, not a generic treeline).
10. **The stage is positioned wrong relative to the two bridges** — its real
    position between them doesn't match the render.
11. **NEW FEATURE (Jonathan): a CAMERA board — zoom like a camera.** The game
    becomes three AV boards: SOUND board, LIGHT board, CAMERA board. Camera
    control (zoom in/out at least) is the third AV station. Goes into the
    next-prompt planning the Producer is drafting (Nov 7) — likely its own
    prompt stage after sound and lights.
12. **Stage arrangement: the drummer is hidden behind another bot** (Jonathan,
    Nov 7 — that's the missing 8th robot from item 4). Prompt 1 v2 placed
    Crash center-back on a low riser and he's STILL hidden. Fix in the
    corrections batch: a staggered formation — Crash raised higher, the
    front line spaced with gaps — so all eight read clearly from the fixed
    camera on load.
13. **NEW FEATURE (Jonathan): the bots' MARKS are kid-adjustable.** Preset
    taped marks on the deck; a kid taps a robot, then taps a mark, and the
    robot moves there (swap if occupied). Default marks guarantee nobody is
    hidden. Staging joins the show-running fantasy alongside the three
    boards; Producer to place it in the prompt sequence.
14. **Orientation: LOCKED to landscape** (Jonathan's ruling, Nov 7, 1:40 PM —
    supersedes Hatch's rotate-prompt idea, which he called backwards). We
    don't care which way the phone is held: the stage is always horizontal.
    If a kid holds the phone vertical, the game simply displays upended on
    its side and they'll rotate it naturally. Spec for the batch: orientation
    locked to landscape; NO separate portrait layout and NO rotate-message
    screen. (Current live build's behavior still unverified — browser window
    can't be resized to phone shape; real-phone check pending.)
    Producer's proposed exact line for Prompt A (corrections batch), item 10,
    relayed via [CC>MUSE] Nov 7, 1:41 PM: "Lock the stage to landscape. The
    stage is always horizontal. If the phone is held upright, the whole game
    displays turned on its side and the kid rotates the phone naturally. Do
    not build a portrait layout. Do not show a 'rotate your device' message
    or screen." Same frame rule applies in prompts B, C, D and E: layouts are
    landscape only, so the bottom dock is always a landscape strip.

## Amendments — Nov 7, ~1:53 PM (Jonathan, on hearing Prompt A read aloud)
- **The crowd (item 2) was never Jonathan's complaint.** It was H-7CH's
  deviation note from the first look at the build (it fills the bottom strip
  reserved for the soundboard); the Producer drafted "remove crowd" from
  that list and H-7CH carried it into Prompt A item 2. Crowd in or out is
  Jonathan's open call — Prompt A does not fire with crowd removal unless
  he says so.
- **Crowd: RULED Nov 7, ~1:54 PM — the crowd STAYS.** Jonathan's reasoning:
  the soundboard will dock over the bottom strip and hide most of them —
  they become background on the lawn — and once kids have the camera board
  they can zoom in over the crowd's heads anyway. His words: "quit trying
  to micromanage and just leave it alone." Prompt A drops crowd removal
  AND the "bottom quarter stays empty" clause (item 7) — the board overlays
  the strip; the scene doesn't need clearing for it.
- **The sun wording is WRONG (Jonathan, Nov 7, ~1:56 PM):** Prompt A's
  "the sun is a light source, never a visible ball in frame" is misleading
  and comes out. The game's own design has a sunset — the sun descends
  toward the horizon and comes down behind the stage, in frame at the
  horizon. A low sun at sunset is correct and expected. The spheres are a
  separate question (unidentified objects hovering beside the stage), not
  a rule about the sun.
- **The spheres (item 3): the blanket "remove regardless" is superseded.**
  Jonathan: just saying remove them is a blanket statement — identify what
  they are first; they look like some kind of lights and may only need
  repositioning up out of frame. A code-view identification was attempted
  Nov 7, 1:52 PM and interrupted before the editor opened — still unknown;
  re-run only on his word. Prompt A item 2 is split and held on both halves.

## Prompt A results (fired Nov 7, 2:27–2:36 PM, republished same run)
LANDED (editor-preview verified, public URL re-verified after publish):
- In-game heading + page title now "ScriptHammer: Lights, Camera, Action".
- Stage fills ~2/3 of screen width; camera closer.
- All 8 robots visible in two rows from one "marks" list; Crash visible
  centre-back at his drums, Ivory at the keyboard. NEW SMALL NIT: the two
  end robots are partly obscured by small pine trees at the stage corners.
- Bridges: Market Street large and close on the RIGHT, Walnut Street
  further right and smaller, none on the left.
- Crowd still present (untouched, per ruling). The two spheres are still
  there, now at the far left/right edges of frame — untouched.
DID NOT CLEARLY LAND (logged for the next batch — do NOT fire piecemeal):
- **River still not visible** — no water band at either side of the back
  wall; the North Shore hill (a red-roofed house visible) reads as
  hillside directly behind the stage instead of a shore across water.
- **Golden hour still weak** — sky pale grey-blue, only a faint warm tint
  at the horizon, no long soft shadows across the lawn.
Prompt count: 4 of 5 used today (1 left); monthly ~21 of 25 left.

15. **The idle bob makes the BAND float (Jonathan, Nov 7, ~3:37 PM, from
    looking at the live build):** the robots bounce up and down OFF the
    stage — lifted a half inch or two, hovering. Wrong assignment of
    motion: if anything moves like that it should be the CROWD (dancing,
    bouncing to the music). The bots, when they move, should move like
    they're PLAYING their instruments or moving to the music — grounded,
    feet/base on the deck, never floating. Fix spec for the next batch
    (and it amends Prompt B's "bob follows tempo" wiring): robots stay
    planted; playing motion + a grounded groove sway; the crowd gets the
    bounce/dance. In the scene-only build there is no music yet, so the
    idle state should be still or near-still until playback exists.

## Already spent (for the record)
- Prompt 1 (9:46 AM): the build itself, 10 of 11 files (Switch's sheet dropped
  by the 10-file limit).
- Prompt 2 (in flight when the rule landed): real-3D scene correction + Switch's
  turnaround attached. Foundational, not iterative — the 3D demand predates the
  build.
- A Prompt 3 (aquarium + clouds) was queued and then COUNTERMANDED before
  submission under this rule; these two notes live here now instead.
