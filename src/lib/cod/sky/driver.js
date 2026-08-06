// driver.js
// Static-sky driver for the Claude-of-Duty (CoD) procedural atmosphere.
// Replaces the ctx-coupled parts of src/sky/index.js for a fixed-hour, no-animation,
// no-lights, no-volumetrics, no-events bake into React-Three-Fiber.
//
// Ports, faithfully:
//   buildSharedUniforms()            <- index.js ~226-286 (the shared uniform block)
//   updateCelestial(cel, shared, h)  <- index.js ~540-794 (_updateCelestial), with the
//                                        DirectionalLight / exposure / ambient / ctx.* / fog
//                                        publishing dropped. Only the LUT/dome/env shader
//                                        inputs survive.
//
// The vendored luts.js / dome.js read these uniforms BY NAME, so names + THREE types
// below must match index.js exactly.

import * as THREE from 'three';
import {
  ATMO, // index.js:5  (ATMO.groundRadiusMM / viewAltitudeMM)
  SUN_ILLUMINANCE_TOP, // index.js:6  (= 5.12 scene units)
  MOON_ILLUMINANCE_NIGHT, // index.js:8  (= 0.30 scene units)
  transmittanceToSpace, // index.js:9  (CPU twin of the transmittance LUT)
} from './atmosphere.js';

// ---- module constant retained from index.js (only one the ported path needs) ----------
// index.js:24 — floor on the beam's luminous transmittance (feeds the beam-floor gain).
const SUN_LUM_FLOOR = 0.35;

// ---- weather defaults that index.js init (lines 142-163) reads into the shared block ----
const W = {
  turbidity: 1.35, // index.js:142
  cloudCoverage: 0.3, // index.js:146
  cloudDensity: 1.9, // index.js:150
  cirrusCoverage: 0.21, // index.js:159
  cirrusOpacity: 0.3, // index.js:160
  horizonMurk: 0.13, // index.js:163
};

const { clamp, lerp, smoothstep, radToDeg } = THREE.MathUtils;

/**
 * The shared uniform object, EXACTLY as index.js builds it at 226-286.
 * The 4 LUT-texture uniforms (uTransmittanceLut / uMultiScatterLut / uSkyViewLut /
 * uSkyAmbientLut) are intentionally ABSENT: the SkyLuts constructor adds them to this
 * same object (luts.js:253-256). Celestial-dependent fields start at their pre-solve
 * defaults and are filled by updateCelestial().
 */
export function buildSharedUniforms() {
  const viewR = ATMO.groundRadiusMM + ATMO.viewAltitudeMM; // index.js:226

  return {
    uMieScale: { value: W.turbidity }, // index.js:228 (weather.turbidity)
    uViewPos: { value: new THREE.Vector3(0, viewR, 0) }, // index.js:229 (MUST be non-zero)

    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, // index.js:231
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, // index.js:232
    uSunIrradiance: { value: new THREE.Vector3() }, // index.js:233 (filled by updateCelestial)
    uMoonIrradiance: { value: new THREE.Vector3() }, // index.js:234 (filled by updateCelestial)
    uSunDiscRadiance: { value: new THREE.Vector3() }, // index.js:235 (filled by updateCelestial)
    uMoonDiscRadiance: { value: new THREE.Vector3() }, // index.js:236 (filled by updateCelestial)
    uSunAltitude: { value: 0 }, // index.js:237 (filled by updateCelestial)
    uMoonAltitude: { value: 0 }, // index.js:238 (filled by updateCelestial)
    uMoonRelAz: { value: 0 }, // index.js:239 (filled by updateCelestial)
    // x/y true angular radii of sun/moon, z/w draw-scale (readability). index.js:245
    uDisc: { value: new THREE.Vector4(0.004654, 0.004516, 3.0, 4.2) },
    // Lower-hemisphere IBL albedo (sand/lime plaster). index.js:249
    uGroundAlbedo: { value: new THREE.Vector3(0.33, 0.29, 0.225) },
    uHorizonMurk: { value: W.horizonMurk }, // index.js:250 (weather.horizonMurk)
    // Sky highlight roll-off knee/overshoot; re-driven by updateCelestial. index.js:253
    uSkyRolloff: { value: new THREE.Vector2(0.3, 1.5) },

    uStarParams: { value: new THREE.Vector4(0, 0.5, 0, 0) }, // index.js:255 (x/y/w re-driven; z=time stays 0)
    uCelestial: { value: new THREE.Matrix3() }, // index.js:256 (filled by updateCelestial)

    uCloudParams: {
      // index.js:258 (coverage, density, 1, time=0)
      value: new THREE.Vector4(W.cloudCoverage, W.cloudDensity, 1, 0),
    },
    uCloudParams2: {
      // index.js:266 (cirrusCov, cirrusOpac, windX, windZ)
      value: new THREE.Vector4(W.cirrusCoverage, W.cirrusOpacity, 0.004, 0.0016),
    },

    // ---- volumetric / camera block (index.js:276-285) ----
    // Present for byte-fidelity with index.js. NONE are read by luts.js / dome.js / the env
    // bake — they belong to the dropped volumetric + fog passes. dome.js overrides its own
    // uInvProj/uCamWorld anyway (dome.js:324-325). Kept so the object matches the source.
    uInvProj: { value: new THREE.Matrix4() }, // index.js:276
    uCamWorld: { value: new THREE.Matrix4() }, // index.js:277
    uCamPos: { value: new THREE.Vector3() }, // index.js:278
    uFog: { value: new THREE.Vector4() }, // index.js:279
    uFog2: { value: new THREE.Vector4() }, // index.js:280
    uFogExt: { value: new THREE.Vector3() }, // index.js:281
    uPhase: { value: new THREE.Vector4() }, // index.js:282
    uKeyDir: { value: new THREE.Vector3(0, 1, 0) }, // index.js:283
    uKeyIrr: { value: new THREE.Vector3() }, // index.js:284
    uFogDrift: { value: new THREE.Vector3() }, // index.js:285
  };
}

/**
 * Populate the celestial-dependent shared uniforms from the sun/moon solve.
 * Faithful port of index.js _updateCelestial (540-794), keeping ONLY the writes the
 * sky-view LUT, ambient LUT and dome/env shaders consume.
 *
 * @param {import('./celestial.js').Celestial} c  a Celestial instance
 * @param {object} s  the object returned by buildSharedUniforms() (LUT textures already added)
 * @param {number} hour  0..24 local solar time
 */
export function updateCelestial(c, s, hour) {
  c.setHour(hour); // index.js:541 — solves sun/moon alt/az/phase + sky matrix

  s.uSunDir.value.copy(c.sun); // index.js:544
  s.uMoonDir.value.copy(c.moon); // index.js:545
  s.uSunAltitude.value = c.sunAlt; // index.js:546
  s.uMoonAltitude.value = c.moonAlt; // index.js:547

  // Moon azimuth RELATIVE to the sun (the sky-view LUT bakes the sun at az 0). index.js:550-553
  let rel = c.moonAz - c.sunAz;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  s.uMoonRelAz.value = rel;
  c.celestialMatrix(s.uCelestial.value); // index.js:554

  const mie = W.turbidity; // index.js:556 (weather.turbidity)

  // ---- sun ---------------------------------------------------------------- index.js:558-616
  const muS = Math.sin(c.sunAlt);
  const discS = clamp(0.5 + muS / (2 * 0.004654), 0, 1);
  const sunT = [0, 0, 0];
  transmittanceToSpace(Math.max(muS, 0.0008), mie, sunT);
  const tint = [1.0, 0.975, 0.94]; // solar spectrum, warm of D65
  const T = sunT;
  const aureoleP = lerp(0.55, 1.0, smoothstep(radToDeg(c.sunAlt), 0, 16));
  const sr = Math.pow(T[0], aureoleP) * tint[0];
  const sg = Math.pow(T[1], aureoleP) * tint[1];
  const sb = Math.pow(T[2], aureoleP) * tint[2];
  const smax = Math.max(1e-6, sr, sg, sb);

  const lumT = 0.2126 * sr + 0.7152 * sg + 0.0722 * sb; // index.js:605
  const altDeg = radToDeg(c.sunAlt);
  const beamAlive = smoothstep(altDeg, -6.0, -1.0);
  const lumFloor = SUN_LUM_FLOOR * beamAlive;
  const beamGain = Math.max(1, lumFloor / Math.max(lumT, 1e-5));
  const baseSunIntensity = SUN_ILLUMINANCE_TOP * smax * discS * beamGain; // index.js:613
  const beamLuminance = SUN_ILLUMINANCE_TOP * Math.max(lumT * beamGain, 1e-6) * discS; // index.js:616

  // Extraterrestrial irradiance handed to the sky LUT (raymarch applies extinction). index.js:620
  s.uSunIrradiance.value.set(
    SUN_ILLUMINANCE_TOP * tint[0],
    SUN_ILLUMINANCE_TOP * tint[1],
    SUN_ILLUMINANCE_TOP * tint[2]
  );

  const discRad = 4000; // index.js:630 (half-float-safe disc radiance)
  s.uSunDiscRadiance.value.set(discRad * tint[0], discRad * tint[1], discRad * tint[2]); // index.js:631

  // ---- night ramps -------------------------------------------------------- index.js:636-638
  const keyRamp = smoothstep(-altDeg, -3, 5);
  const nightRamp = smoothstep(-altDeg, 0, 9);

  // ---- moon --------------------------------------------------------------- index.js:641-664
  const muM = Math.sin(c.moonAlt);
  const discM = clamp(0.5 + muM / (2 * 0.004516), 0, 1);
  const moonT = [0, 0, 0];
  transmittanceToSpace(Math.max(muM, 0.0008), mie, moonT);
  const MT = moonT;
  const cool = [0.66, 0.8, 1.0]; // Purkinje-shifted moonlight tint
  const mr = MT[0] * cool[0];
  const mg = MT[1] * cool[1];
  const mb = MT[2] * cool[2];
  const mmax = Math.max(1e-6, mr, mg, mb);
  let moonI = MOON_ILLUMINANCE_NIGHT * c.moonPhase * mmax * discM * keyRamp; // index.js:655
  // Handover floor (index.js:660): kept because moonI feeds the uSkyRolloff night knee below.
  if (Math.max(baseSunIntensity, moonI) < 0.03) moonI = 0.03;

  const moonIrr = MOON_ILLUMINANCE_NIGHT * c.moonPhase * keyRamp; // index.js:663
  s.uMoonIrradiance.value.set(moonIrr * cool[0], moonIrr * cool[1], moonIrr * cool[2]); // index.js:664

  const moonDisc = lerp(0.35, 3.5, nightRamp); // index.js:671
  s.uMoonDiscRadiance.value.set(moonDisc, moonDisc * 0.985, moonDisc * 0.95); // index.js:672

  // ---- sky roll-off knee -------------------------------------------------- index.js:733-741
  const kneeFrac = lerp(0.045, 0.11, smoothstep(altDeg, 2.0, 15.0));
  s.uSkyRolloff.value.set(Math.max(kneeFrac * beamLuminance, 0.02 + 6.0 * moonI), 0.34);

  // ---- stars -------------------------------------------------------------- index.js:781-783
  s.uStarParams.value.x = 0.07 * nightRamp;
  s.uStarParams.value.y = 0.55;
  s.uStarParams.value.w = 0.16 * nightRamp;

  return s;
}
