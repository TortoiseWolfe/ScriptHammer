# Feature Specification: The band stage at Ross's Landing (/chatt)

**Feature Branch**: `feat/053-band-stage`
**Created**: 2026-10-28
**Status**: In progress
**Issue**: #1413
**Input**: "we can put them on a VR stage in Chattanooga City Map we're already working on" (owner, 2026-10-25)

The house band from feature 052 gets a stage in the city twin. It stands on the open riverfront lawn at Ross's Landing, north of the Tennessee Aquarium, facing the city. A visitor walks up to it in the diorama, hears the band, and on a headset can enter VR.

The stage lives in the React Three Fiber diorama (`?diorama`), because the default Cesium atlas has no WebXR.

## User Scenarios

### US1 - Find the stage (P1)

A visitor on `/band` follows "See them live in Chattanooga" and lands in walk mode in front of the stage, looking at it.

- **Given** the deep link `/chatt/?diorama&walk&at=35.05666,-85.31144&face=0`, **then** walk mode starts at the audience spot facing north, and the stage deck with seven portrait boards is in view.
- The stage stands on the ground the twin reports (`groundAt`), never at a guessed height. With no ground there is no stage.

### US2 - Hear the band (P1)

Near the stage the visitor can play the band's theme as sound that comes from the stage.

- **Given** the visitor is within 150 m of the stage, **then** a "Play the set" button and a "Mute band" toggle appear.
- No audio is fetched until the visitor is within 150 m or presses "Play the set". Nothing plays without a press.
- While the band plays, the city's ambient sound drops to a fifth of its level; it comes back when the band is muted.

### US3 - Enter VR (P2, PR 053b)

A visitor with a headset presses "Enter VR" and sits in front of the stage.

- "Enter VR" shows only when `navigator.xr.isSessionSupported('immersive-vr')` resolves true; iOS and desktops without a headset never see it.
- In the session the scene renders straight to the headset in sRGB without the post-processing composer; the walk rig stops driving the camera. Version 1 is seated.

## Requirements

- **FR-001** `public/twins/chatt/stage.json` holds the stage's name, lat/lon, facing (compass degrees), audience spot and where the spot was read from. Only twins named in one const list request a stage file, so other twins make no 404 request.
- **FR-002** A pure module validates `stage.json` and projects it with the twin's own projection (`createProjection(atlasBox ?? box, vectorOffsetM)`), with unit tests.
- **FR-003** `src/world/BandStage.tsx` draws the deck and seven portrait boards (`ROSTER` from `src/lib/band/roster.ts`, textures through `getAssetUrl`). The portraits are square boards, not cutouts.
- **FR-004** Audio is drei `PositionalAudio` of `/band/audio/band-wagon-theme.mp3`; the button resumes three's AudioContext.
- **FR-005** `useAmbientCity` gains `duck(on)`; a unit test pins the ducked level.
- **FR-006** The controls are a 5-file component outside the canvas, with 44 px targets.
- **FR-007** A `face=<compass degrees>` URL parameter sets the walk heading on entry, parsed next to `parseAtParam` with tests.
- **FR-008** `/band` links to the stage with a plain `<a>`; `/band` stays kid-safe and loads no three.js.
- **FR-009** (053b) `@react-three/xr` 6.6.32; IWER emulation only in development and tests, never in production; xr, pmndrs and iwer packages join the three cache group so the first-load budget holds.
- **FR-010** (053b) StageCore skips the composer and renders sRGB while presenting, without importing `src/world`.

## Out of scope

- Standing or room-scale VR, controllers, teleport (version 1 is seated).
- A stage in the Cesium atlas.
- Stages in other twins.
