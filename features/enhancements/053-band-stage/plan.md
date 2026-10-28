# Implementation Plan: The band stage at Ross's Landing

**Spec**: [spec.md](./spec.md) | **Issue**: #1413

## Shape

| Piece             | Path                                                          |
| ----------------- | ------------------------------------------------------------- |
| Stage data        | `public/twins/chatt/stage.json`                               |
| Placement (pure)  | `src/world/bandStage/placement.ts` + test                     |
| Stage in scene    | `src/world/BandStage.tsx`, mounted in `TwinCanvas` SceneInner |
| Controls (5-file) | `src/components/molecular/BandStageControls`                  |
| Ambient ducking   | `src/lib/cod/audio/ambientCity.ts` (`duck`)                   |
| Walk heading      | `face=` parser in `src/lib/twin-location.ts`                  |
| Entry link        | `src/app/band/page.tsx`                                       |
| VR (053b)         | `@react-three/xr`, `StageCore` presenting branch, Enter VR    |

## Where the stage stands

The spot was read off the twin's own aerial drape (`public/twins/chatt/drape.jpg`) and building footprints: the open lawn north of the aquarium between the tree row and the river, where Riverbend's main stage goes. Centre 35.05681, -85.31144; the front faces south (bearing 180) toward the city; the audience spot is 17 m south.

Projection: `lonLatToEnu` gives `[x, z]` with north = -Z and east = +X. The deck's front is modelled toward +Z (south), so rotation about Y is `-(facing - 180)` in radians. Height is `groundAt(x, z)`.

## Audio

`PositionalAudio` mounts only when the walker is within 150 m (checked at 4 Hz) or after "Play the set". Once mounted it stays mounted. The press resumes three's shared AudioContext. Ambient city sound ducks to 0.2 of its level while the band plays.

## PRs

1. 053a: stage, audio, controls, `face=`, `/band` link, e2e `tests/e2e/band-stage.spec.ts`.
2. 053b: VR, unit test of Enter VR with a mocked `navigator.xr`, e2e `tests/e2e/band-stage-vr.spec.ts` with IWER (Meta Quest 3).

## Tests

Unit (placement, stage.json validation, `face=` parser, ducking, controls), a11y for the controls, e2e deep link shows "Play the set"; first-load budget stays green.
