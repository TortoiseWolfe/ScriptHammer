import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  QUALITY_PRESETS,
  QUALITY_TIERS,
  setQuality,
  useQuality,
} from './quality';

describe('quality presets', () => {
  it('has all four tiers with the generic fields', () => {
    for (const tier of QUALITY_TIERS) {
      const p = QUALITY_PRESETS[tier];
      expect(p.renderScale).toBeGreaterThan(0);
      expect(p.shadowMapSize).toBeGreaterThan(0);
      expect(p.anisotropy).toBeGreaterThan(0);
      expect(p.particleBudget).toBeGreaterThan(0);
    }
  });

  it('drops the CoD post-chain-specific fields', () => {
    expect('taa' in QUALITY_PRESETS.high).toBe(false);
    expect('volumetrics' in QUALITY_PRESETS.high).toBe(false);
    expect('ssr' in QUALITY_PRESETS.high).toBe(false);
  });

  it('budgets scale up with the tier', () => {
    expect(QUALITY_PRESETS.low.particleBudget).toBeLessThan(
      QUALITY_PRESETS.ultra.particleBudget
    );
    expect(QUALITY_PRESETS.low.shadowMapSize).toBeLessThan(
      QUALITY_PRESETS.ultra.shadowMapSize
    );
  });
});

describe('useQuality store', () => {
  beforeEach(() => {
    act(() => setQuality('high'));
  });

  it('defaults to high and returns its preset', () => {
    const { result } = renderHook(() => useQuality());
    expect(result.current.tier).toBe('high');
    expect(result.current.preset).toBe(QUALITY_PRESETS.high);
  });

  it('setTier updates the active tier + preset', () => {
    const { result } = renderHook(() => useQuality());
    act(() => result.current.setTier('low'));
    expect(result.current.tier).toBe('low');
    expect(result.current.preset.particleBudget).toBe(
      QUALITY_PRESETS.low.particleBudget
    );
  });
});
