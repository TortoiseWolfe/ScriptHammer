# Vendored from Claude-of-Duty (MIT) — core gems

Source: https://github.com/mshumer/Claude-of-Duty (Matt Shumer), MIT (see ../LICENSE).

The two framework-agnostic "core gems", ported to typed TS. The OVERWATCH kernel
(engine / registry / prewarm / main) is NOT harvested — React-Three-Fiber replaces
its imperative loop + service locator.

- `event-bus.ts` — the `EventBus` class extracted from `src/core/registry.js:86-122`
  (game events without React re-renders; `on`/`once` return an unsubscribe closure).
- `quality.ts` — `QUALITY_PRESETS` from `src/core/config.js:21` (renderer-generic
  fields only; CoD's post-chain flags taa/gtao/ssr/volumetrics/motionBlur dropped)
  plus a module-store `useQuality()` hook.

Both are three-free with zero runtime dependencies.
