'use client';
import { useThree, useFrame } from '@react-three/fiber';
import { OrthographicCamera, SRGBColorSpace } from 'three';
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
  /** True-orthographic top-down frame (the registration compare view).
   *  Present = active: the composition root passes it only while the
   *  Top-down mode is on. Rendered raw (no composer, no fog) — the whole
   *  point is honest pixels over the aerial. */
  ortho?: {
    center: [number, number];
    halfW: number;
    halfH: number;
    height: number;
  };
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
  ortho,
}: StageCoreProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const timeRef = useRef(0);
  const orthoCamRef = useRef<OrthographicCamera | null>(null);

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
    // Top-down compare mode: TRUE orthographic projection, north-up. A
    // perspective camera splays box tops outward from the view centre even
    // when footprints register perfectly — orthographic is the only honest
    // eyeball judge of vector-vs-aerial alignment. Rendered raw: no composer
    // (tilt-shift blur) and no fog (distance haze), both of which would
    // soften exactly the edges being compared.
    if (ortho) {
      if (!orthoCamRef.current) {
        orthoCamRef.current = new OrthographicCamera();
      }
      const cam = orthoCamRef.current;
      // Cover at least halfW x halfH, expanded to the viewport aspect so
      // pixels stay square (no anisotropic stretch).
      const viewAspect = size.width / size.height;
      let hw = ortho.halfW;
      let hh = ortho.halfH;
      if (hw / hh < viewAspect) hw = hh * viewAspect;
      else hh = hw / viewAspect;
      cam.left = -hw;
      cam.right = hw;
      cam.top = hh;
      cam.bottom = -hh;
      cam.near = 1;
      cam.far = ortho.height * 2;
      cam.position.set(ortho.center[0], ortho.height, ortho.center[1]);
      cam.up.set(0, 0, -1); // -Z (north) toward top of screen
      cam.lookAt(ortho.center[0], 0, ortho.center[1]);
      cam.updateProjectionMatrix();
      const fog = scene.fog;
      scene.fog = null;
      // The composer's Grade pass normally owns the single lin2srgb encode;
      // bypassing it means the renderer must encode instead or the compare
      // view presents linear (dark). Restored right after — the program
      // recompile this triggers happens once per mode switch, not per frame.
      const colorSpace = gl.outputColorSpace;
      gl.outputColorSpace = SRGBColorSpace;
      gl.render(scene, cam);
      gl.outputColorSpace = colorSpace;
      scene.fog = fog;
      return;
    }
    const search = typeof window !== 'undefined' ? window.location.search : '';
    // (?topdown — the old perspective straight-down diagnostic — was retired
    // in #259 iter 5: the true-orthographic `ortho` frame above is the honest
    // registration judge and superseded it.)
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
