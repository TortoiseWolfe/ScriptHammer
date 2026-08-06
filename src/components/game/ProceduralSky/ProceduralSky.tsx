'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
// Vendored, framework-agnostic Claude-of-Duty procedural sky (MIT — see
// src/lib/cod/sky/NOTICE.md). driver.js replaces index.js's OVERWATCH ctx wiring.
import { Celestial } from '@/lib/cod/sky/celestial';
import { SkyLuts } from '@/lib/cod/sky/luts';
import { SkyDome } from '@/lib/cod/sky/dome';
import { hdrTarget, blit } from '@/lib/cod/sky/fullscreen';
import { buildSharedUniforms, updateCelestial } from '@/lib/cod/sky/driver';

export interface ProceduralSkyProps {
  /** Static time of day, 0–24 (local solar). Default 16.5 (hard afternoon key). */
  hour?: number;
  /**
   * Also add the visible sky-dome background mesh. The dome is a raw HDR
   * `ShaderMaterial` (`toneMapped: false`), so it paints the background
   * un-tone-mapped; the IBL env map (always set) is unaffected. Default true.
   */
  showDome?: boolean;
}

/**
 * ProceduralSky — harvested Claude-of-Duty atmospheric sky + IBL (MIT).
 *
 * As a child of an R3F `<Canvas>`, at mount it bakes CoD's procedural sky once
 * (zero assets, no HDRI) and:
 *   - sets `scene.environment` to the PMREM'd env map → existing
 *     `MeshStandardMaterial`s gain real specular/reflections;
 *   - optionally adds the sky-dome mesh (renderOrder −10000, self-tracks the
 *     camera) as the visible background.
 *
 * Harvest-not-embed: R3F owns the renderer + loop; the bake runs off-screen in
 * `useEffect` with the render target saved/restored, and everything it owns is
 * disposed on unmount. Static (fixed `hour`); the component itself renders null.
 * Bake correctness is a Playwright concern (real WebGL); the unit test guards on
 * a missing renderer.
 *
 * @category game
 */
export default function ProceduralSky({
  hour = 16.5,
  showDome = true,
}: ProceduralSkyProps = {}): null {
  const { gl, scene } = useThree();

  useEffect(() => {
    if (!gl || !scene) return; // mocked-Canvas / SSR guard → no-op

    const prevTarget = gl.getRenderTarget();
    const prevEnv = scene.environment;

    // Dependency order (CoD index.js): shared uniforms → SkyLuts (adds the 4 LUT
    // textures to `shared`) → Celestial → SkyDome → bakeStatic → celestial solve
    // → bakeSkyView → equirect blit → PMREM → scene.environment.
    const shared = buildSharedUniforms();
    const luts = new SkyLuts(gl, shared);
    const celestial = new Celestial();
    const dome = new SkyDome(shared);
    const envEquirect = hdrTarget(512, 256, { name: 'sky-equirect' });
    envEquirect.texture.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(gl);
    let pmremRT: THREE.WebGLRenderTarget | null = null;
    let added = false;

    try {
      luts.bakeStatic(); // transmittance + multiscatter (altitude/aerosol)
      updateCelestial(celestial, shared, hour); // fill sun/moon uniforms (before bakeSkyView)
      luts.bakeSkyView(); // sky-view + ambient probe (needs LUTs + sun uniforms)
      pmrem.compileEquirectangularShader();
      blit(gl, dome.envMaterial, envEquirect); // draw the sky into the equirect RT
      pmremRT = pmrem.fromEquirectangular(envEquirect.texture);
      pmremRT.texture.name = 'sky-env';
      scene.environment = pmremRT.texture;
      if (showDome) {
        scene.add(dome.mesh); // background painter, renderOrder −10000
        added = true;
      }
    } catch (err) {
      console.warn('[cod-skeleton] procedural sky bake failed', err);
    } finally {
      gl.setRenderTarget(prevTarget); // restore for R3F's render loop
    }

    return () => {
      if (added) scene.remove(dome.mesh);
      scene.environment = prevEnv;
      dome.dispose(); // .material + .envMaterial (NOT the module-shared geometry)
      luts.dispose(); // 4 RTs + 4 passes
      envEquirect.dispose();
      pmremRT?.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, hour, showDome]);

  return null;
}
