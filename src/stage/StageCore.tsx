'use client';
import { useThree, useFrame } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { buildComposer } from '@/post/tiltShift';

export interface StageHandle {
  setLens: (focus: number, blur: number) => void;
  setGrade: (partial: Record<string, number>) => void;
  setTime: (t: number) => void;
}

export interface StageCoreProps {
  children?: React.ReactNode;
  lens?: { focus: number; blur: number };
  grade?: Record<string, number>;
  onFrame?: (dt: number, t: number) => void;
  registerHandle?: (h: StageHandle) => void;
  /** ?topdown diagnostic frame — where to hover and how high (site-sized).
   *  Without it the ?topdown query param is ignored. */
  topdown?: { center: [number, number]; height: number };
}

// StageCore is the liftable seam: it owns the composer, the single render
// loop, and resize handling, and knows about R3F + the post-processing rig
// ONLY. It must never import from src/world, src/packs, or src/agents — the
// composition root (Task 20) injects project-specific content as `children`.
// See stagecore-imports.test.ts for the enforced guard.
export default function StageCore({
  children,
  lens,
  grade,
  onFrame,
  registerHandle,
  topdown,
}: StageCoreProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const timeRef = useRef(0);

  const rig = useMemo(
    () =>
      buildComposer(gl, scene, camera, {
        width: size.width,
        height: size.height,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- size handled by the setSize effect below, not rebuilt on resize
    [gl, scene, camera]
  );

  useEffect(() => {
    rig.setSize(size.width, size.height);
  }, [rig, size.width, size.height]);

  useEffect(() => {
    if (lens) rig.setLens(lens.focus, lens.blur);
  }, [rig, lens]);

  useEffect(() => {
    if (grade) rig.setGrade(grade);
  }, [rig, grade]);

  useEffect(() => {
    registerHandle?.({
      setLens: rig.setLens,
      setGrade: rig.setGrade,
      setTime: rig.setTime,
    });
    return () => rig.dispose();
  }, [rig, registerHandle]);

  useFrame((_, dt) => {
    timeRef.current += dt;
    rig.setTime(timeRef.current);
    onFrame?.(dt, timeRef.current);
    const search = typeof window !== 'undefined' ? window.location.search : '';
    // ?topdown: dev diagnostic — force a straight-down view over the model to
    // check drape (aerial) vs vector (streets/buildings) georegistration. The
    // frame (center + height) is site-sized and passed in by the composition
    // root; without it the param is ignored.
    if (search.includes('topdown') && topdown) {
      const cam = camera as PerspectiveCamera;
      cam.position.set(topdown.center[0], topdown.height, topdown.center[1]);
      cam.up.set(0, 0, -1); // -Z (north) toward top of screen
      cam.lookAt(topdown.center[0], 0, topdown.center[1]);
      cam.fov = 62;
      cam.updateProjectionMatrix();
      gl.render(scene, camera);
      return;
    }
    // ?nofx bypasses the composer to render the raw scene directly (dev diagnostic
    // for isolating post-processing vs scene issues).
    if (search.includes('nofx')) {
      gl.render(scene, camera);
    } else {
      rig.composer.render(dt);
    }
  }, 1); // renderPriority 1 suppresses R3F's own render; this loop is authoritative

  return <>{children}</>;
}
