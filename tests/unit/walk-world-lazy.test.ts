import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The collision world is built only for walk mode (#718).
 *
 * WHY IT MATTERS. `StaticWorld.build()` is ~780 ms of synchronous main-thread work on the
 * `chatt` city — profiled as `_buildNodes` 556 ms, `_nodeBoundsFromRange` 147 ms and
 * `build` 74 ms. It used to run on EVERY twin route, and nothing outside walk can use it:
 * `?ortho` maps to rig mode `orbit`, and `Rig.collide` is only ever called inside
 * `Rig._walk()`. Paying it on load is what froze `?ortho` hard enough that Playwright could
 * not land a click (#717) — eight consecutive red E2E runs.
 *
 * WHY A SOURCE ASSERTION AND NOT A BEHAVIOURAL ONE. The thing being protected is a
 * *scheduling* property of a React component that owns a WebGL canvas: "this expensive call
 * does not happen unless the mode is walk". Rendering TwinCanvas in jsdom cannot show that —
 * there is no WebGL, no R3F frame loop, and the mesh callbacks never fire. The end-to-end
 * proof is the CPU profile and `twins.spec.ts:98` going green; this pins the two lines that
 * would silently undo it, so a future edit cannot quietly reintroduce a 780 ms load stall.
 */
const SRC = readFileSync(
  join(process.cwd(), 'src', 'twin', 'TwinCanvas.client.tsx'),
  'utf8'
);

describe('lazy walk-world construction (#718)', () => {
  it('tryBuildWalk refuses to build unless walk is the live mode', () => {
    const fn = SRC.slice(
      SRC.indexOf('const tryBuildWalk = useCallback'),
      SRC.indexOf('tryBuildWalkRef.current = tryBuildWalk')
    );
    expect(
      fn.length,
      'tryBuildWalk not found — this test is anchored to a stale shape'
    ).toBeGreaterThan(200);
    expect(
      fn,
      'the walk-mode gate is gone: every twin route would pay ~780 ms of BVH build again'
    ).toContain('if (!wantsWalkWorldRef.current) return;');

    // The gate must come BEFORE the expensive work, not after it.
    const gate = fn.indexOf('wantsWalkWorldRef.current');
    const build = fn.indexOf('EmbodiedController.fromMeshes');
    expect(
      build,
      'controller construction not found in tryBuildWalk'
    ).toBeGreaterThan(0);
    expect(
      gate,
      'the gate sits after the controller is built, so it saves nothing'
    ).toBeLessThan(build);
  });

  it('entering walk mode triggers the build', () => {
    // Without this the gate would be a permanent off-switch and walk mode would never
    // acquire collision at all — a far worse bug than the one being fixed.
    expect(SRC).toMatch(
      /wantsWalkWorldRef\.current = mode === 'walk';\s*\n\s*if \(mode === 'walk'\) tryBuildWalkRef\.current\?\.\(\);/
    );
  });

  it('deferring cannot lose landmark colliders', () => {
    // Colliders now routinely arrive BEFORE the controller exists, where previously that
    // was the rare case. The stash-and-drain path (#702) is what makes deferral safe, so
    // it has to still be there.
    expect(SRC, 'the pending-collider stash is gone').toContain(
      'pendingCollidersRef.current.set(slug, group)'
    );
    expect(SRC, 'the drain into the new controller is gone').toContain(
      'for (const [slug, group] of pendingCollidersRef.current)'
    );
  });

  it('the idempotence guard survives, so a later build is still safe', () => {
    // #703: any repeat call used to dispose the live controller and re-park the bike at
    // spawn. Deferral means more calls, not fewer, so this guard matters more now.
    expect(SRC).toContain('builtFromRef.current');
  });
});
