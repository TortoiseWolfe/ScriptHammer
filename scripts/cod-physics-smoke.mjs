/**
 * r180 -> r184 port smoke test for the vendored Claude-of-Duty physics core.
 *
 * Run from the repo root with the workspace's `three` on the resolution path:
 *   docker compose exec scripthammer node scripts/cod-physics-smoke.mjs
 *   # or, with three installed locally: node scripts/cod-physics-smoke.mjs
 *
 * No renderer, no R3F — just the framework-agnostic BVH + swept-capsule
 * character controller vendored under src/lib/cod/, driven by a minimal
 * gravity/WASD stepper. Proves the extraction ports to the Three r184 that
 * ScriptHammer pins. `scripts/` is excluded from tsconfig + vitest by design;
 * this is a standalone verification harness, not part of the app build.
 */
import * as THREE from 'three';
import { StaticWorld } from '../src/lib/cod/bvh.js';
import { CharacterController } from '../src/lib/cod/character.js';
import { MASK } from '../src/lib/cod/surfaces.js';

console.log('THREE.REVISION =', THREE.REVISION);

function buildWorld(boxes) {
  const world = new StaticWorld();
  for (const [w, h, d, x, y, z, surface] of boxes) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
    mesh.position.set(x, y, z);
    world.addMesh(mesh, surface);
  }
  world.build();
  return world;
}

const dt = 1 / 120;
const GRAVITY = -22;
const SPEED = 4.0;

function step(cc, wishX, wishZ, jump) {
  cc.velocity.y += GRAVITY * dt;
  cc.velocity.x = wishX * SPEED;
  cc.velocity.z = wishZ * SPEED;
  if (jump && cc.grounded) cc.velocity.y = 7;
  cc.move(cc.velocity.x * dt, cc.velocity.y * dt, cc.velocity.z * dt);
  return cc;
}

let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? '  (' + detail + ')' : ''}`); }
  else { fail++; console.log(`  ✗ ${name}  <-- FAIL${detail ? '  (' + detail + ')' : ''}`); }
}

// A. drop & settle
{
  console.log('\nA. drop onto a flat floor (gravity + ground probe + velocity clip)');
  const world = buildWorld([[40, 2, 40, 0, -1, 0, 'dirt']]);
  const cc = new CharacterController(world, { radius: 0.32, height: 1.8, mask: MASK.CHARACTER, position: { x: 0, y: 3, z: 0 } });
  for (let i = 0; i < 240; i++) step(cc, 0, 0, false);
  assert('lands grounded', cc.grounded === true);
  assert('feet settle at floor top y~=0', Math.abs(cc.position.y) < 0.02, `y=${cc.position.y.toFixed(4)}`);
  assert('vertical velocity clipped to ~0', Math.abs(cc.velocity.y) < 0.5, `vy=${cc.velocity.y.toFixed(3)}`);
}

// B. walk on flat
{
  console.log('\nB. walk forward on flat ground (sweep + slide advances)');
  const world = buildWorld([[60, 2, 60, 0, -1, 0, 'dirt']]);
  const cc = new CharacterController(world, { radius: 0.32, height: 1.8, mask: MASK.CHARACTER, position: { x: 0, y: 0.1, z: 0 } });
  for (let i = 0; i < 60; i++) step(cc, 0, 0, false);
  const x0 = cc.position.x;
  for (let i = 0; i < 240; i++) step(cc, 1, 0, false);
  assert('moved forward under input', cc.position.x - x0 > 5, `dx=${(cc.position.x - x0).toFixed(2)}m over 2s`);
  assert('stayed grounded while walking', cc.grounded === true);
}

// C. step up a ledge
{
  console.log('\nC. step up a 0.40 m ledge (stepHeight 0.42 step-offset scheme)');
  const world = buildWorld([
    [40, 2, 40, 0, -1, 0, 'dirt'],
    [20, 0.4, 40, 14, 0.2, 0, 'concrete'],
  ]);
  const cc = new CharacterController(world, { radius: 0.32, height: 1.8, stepHeight: 0.42, mask: MASK.CHARACTER, position: { x: 0, y: 0.1, z: 0 } });
  for (let i = 0; i < 60; i++) step(cc, 0, 0, false);
  for (let i = 0; i < 400; i++) step(cc, 1, 0, false);
  assert('climbed onto the platform', cc.position.x > 6, `x=${cc.position.x.toFixed(2)}`);
  assert('feet now at platform height y~=0.40', Math.abs(cc.position.y - 0.4) < 0.03, `y=${cc.position.y.toFixed(4)}`);
  assert('grounded on top of the platform', cc.grounded === true);
}

// D. no tunnelling
{
  console.log('\nD. blocked by a tall wall at high speed (continuous sweep, no tunnel)');
  const wallFace = 1.5;
  const world = buildWorld([
    [60, 2, 60, 0, -1, 0, 'dirt'],
    [1, 6, 60, 2, 3, 0, 'concrete'],
  ]);
  const cc = new CharacterController(world, { radius: 0.32, height: 1.8, mask: MASK.CHARACTER, position: { x: 0, y: 0.1, z: 0 } });
  for (let i = 0; i < 60; i++) step(cc, 0, 0, false);
  cc.velocity.x = 300; cc.velocity.y = 0; cc.velocity.z = 0;
  cc.move(300 * dt, 0, 0); // 2.5 m in one 8 ms step — would overshoot to x=2.5 without CCD
  assert('did not tunnel through the wall', cc.position.x < wallFace, `x=${cc.position.x.toFixed(3)} (naive would be 2.5)`);
  let maxX = cc.position.x;
  for (let i = 0; i < 120; i++) { step(cc, 1, 0, false); maxX = Math.max(maxX, cc.position.x); }
  assert('sustained push never crosses the wall', maxX < wallFace, `maxX=${maxX.toFixed(3)}`);
  assert('reports a wall contact', cc.touchingWall === true);
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
