'use client';

// The visible player body for THIRD-PERSON Walk (#226) — a REAL rigged, skinned,
// animated human (CesiumMan, CC-BY 4.0; see public/models/NOTICE.md). Mirrors the
// bike's ref-driven pattern: reads the EmbodiedController each frame (no React
// re-render), sits at the player's feet facing travel, plays its walk cycle while
// moving (freezes to idle when still), and is posed for crouch/prone/seated. Shown
// only in third-person (in first-person the camera is inside the body).
//
// CesiumMan ships ONE clip (walk), so idle = paused and crouch/prone/seated are
// group-transform approximations — swap the .glb for a richer rig later; the loader
// is generic.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import {
  Box3,
  Vector3,
  Group,
  Mesh,
  Object3D,
  type AnimationAction,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GroundBlob } from './blobShadow';
import { getAssetUrl } from '@/config/project.config';
import type { EmbodiedController } from '@/lib/cod';
import type { BikeView } from '@/stage/embodiedWalk';

const TARGET_HEIGHT = 1.8; // metres — real human
// CesiumMan faces +Z in model space; the player's forward is −Z at yaw 0, so add π
// to face the travel direction. (Tune if the character walks backwards.)
const YAW_OFFSET = Math.PI;

export default function PlayerCharacter({
  ctrlRef,
  viewRef,
}: {
  ctrlRef: { current: EmbodiedController | null };
  viewRef: { current: BikeView };
}) {
  const root = useRef<Group>(null); // placed + yawed at the player
  const inner = useRef<Group>(null); // posed for stance; the model lives inside
  const blobRef = useRef<Mesh>(null); // fake ground shadow, both views
  // getAssetUrl, NOT getInternalUrl. The latter routes through normalizePagePath,
  // which appends a trailing slash to anything without a query or hash — correct
  // for a route under `trailingSlash: true`, fatal for a binary asset. It produced
  // `/models/CesiumMan.glb/`, which 404s while the slashless form serves 200, and
  // useGLTF throws that during render straight into the page's error boundary.
  // `/chatt/?diorama` was a "Page Error" card in production for a day and a half.
  const url = getAssetUrl('/models/CesiumMan.glb');
  const { scene, animations } = useGLTF(url);

  // Clone the skinned scene (drei caches + shares it), enable shadows, then
  // normalize height to ~1.8 m and seat the feet at y=0.
  const model = useMemo(() => {
    const c = cloneSkeleton(scene) as Object3D;
    c.traverse((o) => {
      o.castShadow = true;
      o.frustumCulled = false; // skinned bounds are unreliable → don't cull
    });
    // World matrices MUST be current before Box3.setFromObject or a skinned mesh
    // measures in the wrong space → bogus size → giant/tiny character.
    c.updateMatrixWorld(true);
    const size = new Box3().setFromObject(c).getSize(new Vector3());
    const s = TARGET_HEIGHT / (size.y || 1);
    c.scale.setScalar(s);
    c.updateMatrixWorld(true);
    c.position.y = -new Box3().setFromObject(c).min.y; // feet on the ground
    return c;
  }, [scene]);

  const { actions, mixer } = useAnimations(animations, model);
  const walk = useRef<AnimationAction | null>(null);

  useEffect(() => {
    const names = Object.keys(actions);
    const a = names.length ? actions[names[0]] : null;
    if (a) {
      a.play();
      a.paused = true; // idle until moving
    }
    walk.current = a ?? null;
    return () => {
      a?.stop();
    };
  }, [actions]);

  useFrame((_s, dt) => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;

    // Blob shadow tracks the feet in BOTH views (you see your own shadow in
    // first-person too); ctrl.position.y is already ground-contact.
    const blob = blobRef.current;
    if (blob) {
      const fp = ctrl.position;
      blob.position.set(fp.x, fp.y + 0.03, fp.z);
    }

    const g = root.current;
    const fig = inner.current;
    if (!g || !fig) return;

    // First-person = camera inside the body → hide it. Third-person shows it.
    g.visible = viewRef.current === 'third';
    if (!g.visible) return;

    const p = ctrl.position;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = ctrl.facingYaw + YAW_OFFSET;

    // Stance pose on the inner group (the skeletal animation plays within it).
    if (ctrl.riding) {
      fig.rotation.x = 0.2;
      fig.position.y = 0.55; // up onto the saddle
      fig.scale.set(1, 0.9, 1);
    } else if (ctrl.stance === 'prone') {
      fig.rotation.x = -Math.PI / 2; // lie flat, face-down along travel
      fig.position.y = 0.2;
      fig.scale.set(1, 1, 1);
    } else if (ctrl.stance === 'crouch') {
      fig.rotation.x = 0.15;
      fig.position.y = 0;
      fig.scale.set(1, 0.6, 1); // compressed / low
    } else {
      fig.rotation.x = 0;
      fig.position.y = 0;
      fig.scale.set(1, 1, 1);
    }

    // Walk clip only while standing + actually moving; otherwise a frozen idle.
    const a = walk.current;
    if (a) {
      const speed = dt > 0 ? ctrl.movedThisFrame / dt : 0;
      const moving = !ctrl.riding && ctrl.stance === 'stand' && speed > 0.3;
      a.paused = !moving;
      if (moving) a.timeScale = Math.min(2.5, Math.max(0.6, speed / 2));
    }
    mixer.update(dt);
  });

  return (
    <>
      {/* Fake ground shadow (real-time shadow map retired) — a soft disc under
          the feet, shown in first- AND third-person so you always read grounded. */}
      <GroundBlob ref={blobRef} size={1.3} opacity={0.5} />
      <group ref={root} visible={false}>
        <group ref={inner}>
          <primitive object={model} />
        </group>
      </group>
    </>
  );
}
