# Tasks: The band stage at Ross's Landing

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Issue**: #1413

## PR 053a: the stage

- [x] T001 `public/twins/chatt/stage.json`; `src/world/bandStage/placement.ts` (validate, project, rotate) + unit tests
- [x] T002 `duck(on)` in `useAmbientCity` + test
- [x] T003 `face=` parser in `src/lib/twin-location.ts` + tests; apply after walk entry in `TwinCanvas`
- [x] T004 `src/world/BandStage.tsx`: deck, seven portrait boards, PositionalAudio, near check; mount in SceneInner
- [x] T005 Generate `BandStageControls` (5-file); wire into `TwinCanvas` overlays
- [x] T006 "See them live in Chattanooga" link on `/band` + test
- [x] T007 `tests/e2e/band-stage.spec.ts`
- [ ] T008 Format, lint, type-check, tests, gitleaks; PR "Refs #1413"; squash-merge on green

## PR 053b: VR

- [ ] T009 Add `@react-three/xr` 6.6.32 and `iwer` (dev); cache group in `next.config.ts`
- [ ] T010 XR store and `<XR>` in the canvas, `XROrigin` seated facing the stage; Enter VR button gated on `isSessionSupported`
- [ ] T011 StageCore presenting branch (no composer, sRGB); Rig stops while presenting
- [ ] T012 Unit test of Enter VR with mocked `navigator.xr`; `tests/e2e/band-stage-vr.spec.ts` with IWER
- [ ] T013 Checks green; PR "Closes #1413"; squash-merge; stage screenshot from Pages
