import { mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { fetchOsm } from './fetch-osm';
import { fetchTerrain } from './fetch-terrain';
import { fetchDrape } from './fetch-drape';
import { buildScene } from './build-scene';

export const bakeOrder = [
  'fetch-osm',
  'fetch-terrain',
  'fetch-drape',
  'build-scene',
] as const;

const RAW = 'public/chatt/_raw';
const OUT = 'public/chatt';
const TMP = 'public/chatt/_tmp';

export async function run() {
  mkdirSync(RAW, { recursive: true });
  console.log('[bake] fetch-osm...');
  console.log(await fetchOsm(RAW));
  console.log('[bake] fetch-terrain...');
  await fetchTerrain(RAW);
  console.log('[bake] fetch-drape...');
  console.log(await fetchDrape(RAW));
  console.log('[bake] build-scene -> temp...');
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  const manifest = await buildScene(RAW, TMP);
  // Atomic swap: build-scene writes into TMP (never touching OUT), so if any
  // fetch or build step above throws, OUT still holds the last-known-good
  // derived files untouched. Only once TMP is fully populated do we copy the
  // finished files into OUT, so the dev watcher never observes a partial set.
  for (const f of [
    'buildings.json',
    'streets.json',
    'heroes.json',
    'terrain.json',
    'manifest.json',
    'drape.jpg',
  ]) {
    if (existsSync(`${TMP}/${f}`)) {
      cpSync(`${TMP}/${f}`, `${OUT}/${f}`);
    }
  }
  rmSync(TMP, { recursive: true, force: true });
  console.log('[bake] done. rules:', JSON.stringify(manifest.ruleHistogram));
}

if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
