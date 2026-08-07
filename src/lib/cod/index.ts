/**
 * Public API for the harvested Claude-of-Duty game toolkit (MIT).
 *
 * A procedural, asset-free React-Three-Fiber game toolkit: swept-capsule physics,
 * a procedural PBR material forge, an atmospheric sky + IBL, procedural audio,
 * a GPU particle system, camera-feel springs, and the core gems (event bus +
 * quality tiers). Import everything from `@/lib/cod`. See ./README.md and the
 * per-subdir NOTICE.md files (MIT attribution).
 */

// ── React hooks (client) ──────────────────────────────────────────────────────
export { useFootsteps } from './audio/useFootsteps';
export type { UseFootsteps } from './audio/useFootsteps';
export { useAmbientCity } from './audio/ambientCity';
export type { UseAmbientCity } from './audio/ambientCity';
export { useFootstepDust } from './fx/useFootstepDust';
export type { UseFootstepDust } from './fx/useFootstepDust';
export { useWeather } from './fx/useWeather';
export type { UseWeather, WeatherKind } from './fx/useWeather';
export { useCameraFeel } from './player/useCameraFeel';
export type { CameraFeel } from './player/useCameraFeel';

// ── Core gems ─────────────────────────────────────────────────────────────────
export { EventBus, bus } from './core/event-bus';
export type {
  GameEvents,
  Handler,
  Unsubscribe,
  Vec3Payload,
} from './core/event-bus';
export { QUALITY_PRESETS, QUALITY_TIERS, useQuality, setQuality } from './core/quality';
export type { QualityTier, QualityPreset, UseQuality } from './core/quality';

// ── Physics (typed) ───────────────────────────────────────────────────────────
export { StaticWorld } from './bvh';
export type { HitRecord, AddMeshOptions } from './bvh';
export { CharacterController } from './character';
export type { CharacterControllerOptions, Vec3 } from './character';

// ── Embodied first-person controller (physics + gravity + stances) ────────────
export { EmbodiedController } from './player/EmbodiedController';
export type {
  EmbodiedConfig,
  EmbodiedInput,
  Stance,
  StanceCfg,
  SprintCfg,
  Vec3Like,
} from './player/EmbodiedController';

// ── Materials · particles · sky · springs (vendored JS, loose-typed) ──────────
export { MaterialSystem } from './materials';
export { ParticleLayer, resetSpawn } from './fx/particles';
export { SkyDome } from './sky/dome';
export { Spring, RecoilAxis } from './springs';

// ── Surface vocabulary ────────────────────────────────────────────────────────
export {
  MASK,
  SURFACE,
  LAYER,
  SURFACE_NAMES,
  SURFACE_PROPS,
  surfaceName,
  surfaceIndex,
  guessSurface,
} from './surfaces';
