'use client';

import { useSyncExternalStore } from 'react';

/**
 * Quality tiers — ported to typed TS from Claude-of-Duty (MIT),
 * `src/core/config.js:21` (QUALITY_PRESETS). Only the renderer-generic fields are
 * kept; CoD's post-chain-specific flags (taa/gtao/ssr/volumetrics/motionBlur) are
 * dropped — wire your own `@react-three/postprocessing` passes if you want them.
 *
 * The active tier lives in a module store (shared across all `useQuality`
 * consumers, no context provider needed); initialised from the `?q=` URL param.
 */

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  /** Multiplier on devicePixelRatio → feed a clamped value to `<Canvas dpr>`. */
  renderScale: number;
  shadowMapSize: number;
  cascades: number;
  shadowDistance: number;
  anisotropy: number;
  particleBudget: number;
  decalBudget: number;
  bloom: boolean;
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  low: {
    renderScale: 0.72,
    shadowMapSize: 1024,
    cascades: 3,
    shadowDistance: 60,
    anisotropy: 4,
    particleBudget: 2000,
    decalBudget: 64,
    bloom: true,
  },
  medium: {
    renderScale: 0.85,
    shadowMapSize: 2048,
    cascades: 3,
    shadowDistance: 90,
    anisotropy: 8,
    particleBudget: 6000,
    decalBudget: 128,
    bloom: true,
  },
  high: {
    renderScale: 1.0,
    shadowMapSize: 2048,
    cascades: 4,
    shadowDistance: 140,
    anisotropy: 16,
    particleBudget: 12000,
    decalBudget: 256,
    bloom: true,
  },
  ultra: {
    renderScale: 1.0,
    shadowMapSize: 4096,
    cascades: 4,
    shadowDistance: 200,
    anisotropy: 16,
    particleBudget: 24000,
    decalBudget: 512,
    bloom: true,
  },
};

export const QUALITY_TIERS: readonly QualityTier[] = [
  'low',
  'medium',
  'high',
  'ultra',
];

function isTier(v: string | null): v is QualityTier {
  return v === 'low' || v === 'medium' || v === 'high' || v === 'ultra';
}

/** Initial tier from the `?q=` URL param, else 'high'. */
function initialTier(): QualityTier {
  if (typeof window === 'undefined') return 'high';
  const q = new URLSearchParams(window.location.search).get('q');
  return isTier(q) ? q : 'high';
}

// ---- module store (shared; survives re-renders) --------------------------------
let currentTier: QualityTier = initialTier();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot(): QualityTier {
  return currentTier;
}
function getServerSnapshot(): QualityTier {
  return 'high';
}

/** Set the active quality tier (notifies every `useQuality` consumer). */
export function setQuality(tier: QualityTier): void {
  if (tier === currentTier) return;
  currentTier = tier;
  for (const cb of [...listeners]) cb();
}

export interface UseQuality {
  tier: QualityTier;
  preset: QualityPreset;
  setTier: (tier: QualityTier) => void;
}

/** Subscribe to the active quality tier + its preset. */
export function useQuality(): UseQuality {
  const tier = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { tier, preset: QUALITY_PRESETS[tier], setTier: setQuality };
}
