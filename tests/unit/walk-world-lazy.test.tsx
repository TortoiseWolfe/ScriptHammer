/**
 * Walk mode must be REACHABLE, and the collision world must stay lazy (#718).
 *
 * WHAT THIS REPLACES, AND WHY. The previous version of this file was a set of regexes over
 * `TwinCanvas.client.tsx`'s source text. One of them was written to prevent exactly the bug
 * that then shipped — its comment reads "Without this the gate would be a permanent
 * off-switch and walk mode would never acquire collision at all — a far worse bug than the
 * one being fixed" — and it passed the whole time walk mode was dead in production, because
 * it only asserted that the unlock line had been TYPED. Nothing asked whether any path could
 * reach it.
 *
 * The bug it missed was a four-hop cycle: `mode === 'walk'` needs `walkReady`, which needs
 * `walkCtrl`, which needs `tryBuildWalk` to pass its gate, which needs `wantsWalkWorldRef`,
 * which was assigned `mode === 'walk'`. The gate asked its own output for permission to open.
 * `/chatt?diorama&walk` — the navbar "Play" link — sat in a slowly rotating orbit shot
 * forever.
 *
 * WHY A RENDER TEST AND NOT A SIMULATION. The defect is not in any predicate; every one of
 * them returns correctly in isolation, before and after the fix. It is in the dependency
 * DIRECTION between a gate and its own downstream output — in the edges. A hand-written
 * fixpoint over those edges would encode them as test data, i.e. a second copy of the wiring
 * that no user ever executes, and would keep passing the day the component is rewired. So
 * this renders the real component and mocks only the ENVIRONMENT (the WebGL canvas, the
 * world, the agents), letting the real cycle run through real React with real `useCallback`
 * identities and React's real child-before-parent effect ordering.
 *
 * WHY NOT THE E2E THAT ALREADY EXISTS. `tests/e2e/twin-walk-visible.spec.ts` drives this
 * exact URL — and `test.skip`s on software GL. CI runners are software-rendered, so it has
 * never run there, and the whole E2E workflow sits behind a budget gate besides. This file
 * needs no GPU and no backend, so it runs in `Test (20.x)`, which is required.
 *
 * WHAT THIS FILE DOES **NOT** COVER — read before trusting a green run.
 *
 * It proves walk is reachable GIVEN the three handovers fire. It cannot prove they fire,
 * because it fires them itself: `@/world/TwinWorld` is mocked, and `arrive()` calls
 * `onTerrainMesh` / `onBuildingsMesh` / `onGroundReady` directly. The PRODUCER half —
 * `Buildings.tsx` / `Terrain.tsx` → `onMeshReady` → `WideCity.tsx` → `TwinWorld.tsx` →
 * `TwinCanvas` — has no coverage here, and none anywhere else in a required check either.
 * A type-clean regression there kills walk mode with the exact #723 symptom while all eight
 * cases below stay green.
 *
 * That gap is tracked in #725. Closing it is real work rather than another case in this
 * file: `TwinWorld` and `WideCity` load site JSON and a `TextureLoader` drape, so running
 * the real producer under jsdom needs a second, larger harness. Do not paper over it by
 * loosening the mocks here — that would trade a test that proves something narrow and true
 * for one that proves something broad and shaky.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { Mesh, PlaneGeometry, MeshBasicMaterial, Group } from 'three';
// Type-only: erased at runtime, so it is unaffected by the vi.mock below. This is the pin
// that replaces the deleted regexes — rename `onBuildingsMesh` and `pnpm type-check` fails,
// which in CI runs BEFORE the tests.
import type TwinWorldComponent from '@/world/TwinWorld';

type TwinWorldProps = React.ComponentProps<typeof TwinWorldComponent>;

const H = vi.hoisted(() => ({
  /** The instrument: whatever props TwinWorld was last rendered with. */
  world: { props: null as unknown },
}));

// ── environment mocks ───────────────────────────────────────────────────────────
// Everything here is the ENVIRONMENT the component runs in, never its logic. The four-hop
// cycle under test lives entirely in TwinCanvas.client.tsx and is untouched.

vi.mock('@react-three/fiber', async () => {
  const React = await import('react');
  const three = await import('three');
  const state = {
    camera: new three.PerspectiveCamera(50, 16 / 9, 1, 20000),
    gl: {
      domElement: document.createElement('canvas'),
      info: { autoReset: true, reset: () => {} },
      setAnimationLoop: () => {},
      render: () => {},
      shadowMap: { enabled: false },
      toneMapping: 0,
      outputColorSpace: '',
      setSize: () => {},
      dispose: () => {},
    },
    scene: new three.Scene(),
    size: { width: 1280, height: 720 },
    clock: { getElapsedTime: () => 0 },
    invalidate: () => {},
  };
  return {
    // A plain <div>: the R3F children below still mount and run their effects, which is the
    // whole point — the mesh handovers must reach tryBuildWalk the way they do in the app.
    Canvas: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'canvas' }, children),
    useThree: (sel?: (s: typeof state) => unknown) =>
      sel ? sel(state) : (state as unknown),
    useFrame: () => {},
    extend: () => {},
  };
});

// Passthrough: the real one builds a postprocessing composer against a live WebGL context.
vi.mock('@/stage/StageCore', async () => {
  const React = await import('react');
  return {
    default: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

// THE INSTRUMENT. Publishes its props so each test can fire the three arrivals itself, in an
// explicit order, one act() each — stricter than production, and what makes cases 1-3 three
// distinct tests rather than one.
vi.mock('@/world/TwinWorld', async () => ({
  default: (props: unknown) => {
    H.world.props = props;
    return null;
  },
}));

vi.mock('@/agents/trolley', () => ({ default: () => null }));
vi.mock('@/agents/bike', () => ({ default: () => null }));
vi.mock('@/agents/playerCharacter', () => ({ default: () => null }));
vi.mock('@/components/game/ProceduralSky', () => ({ default: () => null }));

// The SHIPPED chatt manifest, off disk — not a fixture. Its wide atlasBox is what makes
// `hasTour` false and the initial mode `orbit`, which is the exact state the deadlock strands
// you in. A synthetic manifest could quietly stop reproducing that.
vi.mock('@/lib/manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/manifest')>();
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const manifest = JSON.parse(
    readFileSync(
      join(process.cwd(), 'public', 'twins', 'chatt', 'manifest.json'),
      'utf8'
    )
  );
  return {
    ...actual,
    loadManifest: async () => manifest,
    loadHouse: async () => null,
    loadLocalLinks: async () => [],
    loadWarehouseModels: async () => null,
  };
});

// Imported AFTER the mocks so it picks them up. `@/lib/cod` is deliberately REAL: the spy
// below counts real `EmbodiedController.fromMeshes` calls, so "the BVH was not built" is a
// measurement rather than an assertion about a stub.
import TwinCanvas, { modesForSite } from '@/twin/TwinCanvas.client';
import { EmbodiedController } from '@/lib/cod';

/** A 2-triangle plane. Real geometry, real BVH bake, microseconds, no GL. */
function mkMesh(): Mesh {
  const g = new PlaneGeometry(4000, 4000);
  g.rotateX(-Math.PI / 2);
  const m = new Mesh(g, new MeshBasicMaterial());
  m.updateMatrixWorld(true);
  return m;
}

const groundAt = () => 12.5;

function props(): TwinWorldProps {
  const p = H.world.props as TwinWorldProps | null;
  if (!p) throw new Error('TwinWorld never rendered — the harness is broken');
  return p;
}

type Arrival = 'terrain' | 'buildings' | 'ground';

/** Fire the three handovers in an explicit order, one act() per arrival. */
async function arrive(order: Arrival[]) {
  for (const which of order) {
    await act(async () => {
      if (which === 'terrain') props().onTerrainMesh?.(mkMesh());
      else if (which === 'buildings') props().onBuildingsMesh?.(mkMesh());
      else props().onGroundReady?.(groundAt);
    });
  }
}

async function mount(search: string) {
  window.history.replaceState({}, '', `/chatt/${search}`);
  const view = render(<TwinCanvas slug="chatt" />);
  // Flush the manifest load in TwinCanvas's effect.
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

/** The badge the app renders only while `mode === 'walk'` (TwinCanvas.client.tsx:1517-1538) —
 *  the same selector twin-walk-visible.spec.ts:69 waits on. */
const stance = () => document.querySelector('[data-stance]');

/** Declared via the call itself so the spy keeps `fromMeshes`'s real signature — annotating
 *  it as a bare `ReturnType<typeof vi.spyOn>` widens the args to `unknown[]` and fails
 *  type-check. */
const spyFromMeshes = () => vi.spyOn(EmbodiedController, 'fromMeshes');
let fromMeshes: ReturnType<typeof spyFromMeshes>;

beforeEach(() => {
  H.world.props = null;
  fromMeshes = spyFromMeshes();

  // The scene's `<ambientLight>` / `<fog>` / `<color>` are R3F intrinsics, and rendering them
  // through the DOM renderer makes React complain about casing on every mount. Filter THAT
  // ONE message and pass everything else through — a blanket console.error stub here would
  // hide the React errors this test exists to notice.
  const realError = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('incorrect casing'))
      return;
    realError(...args);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('walk mode is reachable (#718)', () => {
  // Cases 1-3: the regression. Each varies WHICH of the three inputs lands last, because the
  // build is attempted from all three callbacks and the deadlock must be proved independent
  // of arrival order — not an artefact of one sequence.
  const ORDERS: Record<string, Arrival[]> = {
    'ground sampler last': ['terrain', 'buildings', 'ground'],
    'terrain mesh last': ['buildings', 'ground', 'terrain'],
    'buildings mesh last': ['ground', 'terrain', 'buildings'],
  };

  for (const [label, order] of Object.entries(ORDERS)) {
    it(`?walk enters walk mode — ${label}`, async () => {
      await mount('?diorama&walk');
      await arrive(order);

      expect(
        fromMeshes,
        'the collision world was never built, so `walkReady` never fired and the ' +
          '`?walk` deep-link could never leave orbit — this is the deadlock'
      ).toHaveBeenCalledTimes(1);
      expect(
        stance(),
        '`?walk` never reached walk mode: the stance badge only renders while ' +
          'mode === "walk", so the player is stuck in the orbiting city shot'
      ).not.toBeNull();
    });
  }
});

describe('the collision world stays lazy (#718)', () => {
  // The perf property #718 bought. Behavioural replacements for the two deleted source
  // regexes ("the gate exists" / "the gate sits before the build"): a gate in the wrong place
  // shows up here as a call that should not have happened.
  it('no walk intent — the ~780 ms BVH is never built', async () => {
    await mount('?diorama');
    await arrive(['terrain', 'buildings', 'ground']);
    expect(
      fromMeshes,
      'the collision BVH was built on a route that cannot use it — ~780 ms of ' +
        'synchronous main-thread work, which is what froze #717'
    ).not.toHaveBeenCalled();
    expect(stance()).toBeNull();
  });

  it('?ortho — the ~780 ms BVH is never built', async () => {
    await mount('?diorama&ortho');
    await arrive(['terrain', 'buildings', 'ground']);
    expect(fromMeshes).not.toHaveBeenCalled();
  });

  it('entering walk manually still builds it', async () => {
    // The digit keys index positionally into the full mode list, so pin the mapping here —
    // otherwise adding a mode silently retargets this test to a different one.
    expect(modesForSite(false, true)[2]?.key).toBe('walk');

    await mount('?diorama');
    await arrive(['terrain', 'buildings', 'ground']);
    expect(fromMeshes).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' }));
    });

    expect(
      fromMeshes,
      'entering walk by hand did not build the collision world — the gate is a ' +
        'permanent off-switch'
    ).toHaveBeenCalledTimes(1);
    expect(stance()).not.toBeNull();
  });
});

describe('deferral keeps the guarantees it was built on', () => {
  it('repeat arrivals do not rebuild and re-park you (#703)', async () => {
    // Rebuilding re-ran parkBike(spawn), which teleported the player mid-session — reported
    // as "sometimes my bike just randomly gets pulled somewhere else".
    await mount('?diorama&walk');
    const terrain = mkMesh();
    const buildings = mkMesh();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        props().onTerrainMesh?.(terrain);
        props().onBuildingsMesh?.(buildings);
        props().onGroundReady?.(groundAt);
      });
    }
    expect(
      fromMeshes,
      'the same three inputs rebuilt the collision world, which re-parks the player'
    ).toHaveBeenCalledTimes(1);
  });

  it('colliders arriving before the controller are not lost (#702)', async () => {
    // Deferring the build makes "collider first" the COMMON case rather than the rare one,
    // so the stash-and-drain path is load-bearing now in a way it was not before.
    const addCollider = vi.spyOn(EmbodiedController.prototype, 'addCollider');
    await mount('?diorama&walk');
    const group = new Group();
    await act(async () => {
      props().registerCollider?.('riverfront-bridge', group);
    });
    await arrive(['terrain', 'buildings', 'ground']);

    expect(fromMeshes).toHaveBeenCalledTimes(1);
    expect(
      addCollider.mock.calls.map((c) => c[0]),
      'a landmark collider that arrived before the controller was dropped'
    ).toContain(group);
  });
});
