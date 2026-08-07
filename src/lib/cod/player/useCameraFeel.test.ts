/**
 * useCameraFeel — behavior test.
 *
 * The springs are pure math (no GPU/DOM), so unlike the audio/fx hooks this runs
 * for real in jsdom and asserts actual camera motion: head-bob oscillation while
 * walking, no static offset at rest, and a landing dip that recovers.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCameraFeel } from './useCameraFeel';

const BASE_Y = 1.55;
const DT = 1 / 60;
const WALK = 4.5 * DT; // metres travelled per frame while walking (~4.5 m/s)

function baseCam() {
  return { position: { x: 0, y: BASE_Y, z: 10 } };
}

describe('useCameraFeel', () => {
  it('head-bob oscillates camera.y above and below the base while walking', () => {
    const { result } = renderHook(() => useCameraFeel());
    const { apply } = result.current;
    const cc = { grounded: true, landingSpeed: 0 };
    const offsets: number[] = [];
    for (let i = 0; i < 120; i++) {
      const cam = baseCam();
      apply(cam, cc, WALK, DT, 0);
      offsets.push(cam.position.y - BASE_Y);
    }
    expect(Math.max(...offsets)).toBeGreaterThan(0.01); // bobs up
    expect(Math.min(...offsets)).toBeLessThan(-0.01); // and down
  });

  it('settles to ~no offset once the camera stops', () => {
    const { result } = renderHook(() => useCameraFeel());
    const { apply } = result.current;
    const cc = { grounded: true, landingSpeed: 0 };
    for (let i = 0; i < 60; i++) apply(baseCam(), cc, WALK, DT, 0); // walk
    for (let i = 0; i < 180; i++) apply(baseCam(), cc, 0, DT, 0); // then stop
    const cam = baseCam();
    apply(cam, cc, 0, DT, 0);
    expect(Math.abs(cam.position.y - BASE_Y)).toBeLessThan(0.005);
  });

  it('landing dips the camera below the base, then recovers', () => {
    const { result } = renderHook(() => useCameraFeel());
    const { apply } = result.current;
    apply(baseCam(), { grounded: true, landingSpeed: 0 }, 0, DT, 0); // grounded baseline
    apply(baseCam(), { grounded: false, landingSpeed: 0 }, 0, DT, 0); // airborne

    const landed = { grounded: true, landingSpeed: 6 };
    let minOffset = 0;
    for (let i = 0; i < 90; i++) {
      const cam = baseCam();
      apply(cam, landed, 0, DT, 0); // stays grounded → kicks once, then settles
      minOffset = Math.min(minOffset, cam.position.y - BASE_Y);
    }
    expect(minOffset).toBeLessThan(-0.02); // dipped down on impact

    const cam = baseCam();
    apply(cam, landed, 0, DT, 0);
    expect(Math.abs(cam.position.y - BASE_Y)).toBeLessThan(0.01); // recovered
  });

  it('bobScale multiplies the head-bob amplitude', () => {
    const cc = { grounded: true, landingSpeed: 0 };
    const peak = (scale: number): number => {
      const { result } = renderHook(() => useCameraFeel());
      const { apply } = result.current;
      let max = 0;
      for (let i = 0; i < 120; i++) {
        const cam = baseCam();
        apply(cam, cc, WALK, DT, 0, scale);
        max = Math.max(max, cam.position.y - BASE_Y);
      }
      return max;
    };
    expect(peak(2)).toBeGreaterThan(peak(1) * 1.5); // ~2×, with margin
  });
});
