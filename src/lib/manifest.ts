import { getAssetUrl } from '@/config/project.config';

export interface Manifest {
  box: { swLat: number; swLon: number; neLat: number; neLon: number };
  groundWm: number;
  groundHm: number;
  cosLat: number;
  drape: { path: string; width: number; height: number; mpp: number };
  provenance: string;
  fetchedAt: string;
  ruleHistogram: Record<string, number>;
}

export interface Building {
  id: number;
  ring: number[];
  height: number;
  rule: string;
  swap?: string;
}

export interface Street {
  pts: number[];
}

export interface TerrainGrid {
  cols: number;
  rows: number;
  heights: number[];
}

export interface Hero {
  swap: string;
  x: number;
  z: number;
  name: string;
}

export async function loadJson<T>(name: string): Promise<T> {
  const res = await fetch(getAssetUrl(`/chatt/${name}`));
  if (!res.ok) {
    throw new Error(`asset ${name} -> HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const loadManifest = (): Promise<Manifest> =>
  loadJson<Manifest>('manifest.json');
