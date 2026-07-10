#!/usr/bin/env node
/**
 * Photoreal-preserving optimization for as-built scans (#234 portfolio).
 *
 * Unlike the warehouse "sampling" pass, this KEEPS the photo textures — they
 * are the premium demo — and only compresses: dedup/weld, texture → WebP at a
 * capped resolution, meshopt geometry compression. Geometry is NOT simplified
 * (scan fidelity is the product).
 *
 * Run:  docker compose exec scripthammer node scripts/house/optimize-scan.mjs \
 *         --in public/twins/<slug>/house/model.glb [--max 2048] [--quality 80]
 *       Writes <in>.optimized.glb beside the input; swap manually after
 *       eyeballing the property page.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const { values: args } = parseArgs({
  options: {
    in: { type: 'string' },
    max: { type: 'string', default: '2048' },
    quality: { type: 'string', default: '80' },
  },
});
if (!args.in) throw new Error('--in <model.glb> required');
const max = Number(args.max);

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

const inBytes = (await readFile(args.in)).length;
const doc = await io.read(args.in);

await doc.transform(
  dedup(),
  textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    resize: [max, max],
    quality: Number(args.quality),
  }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' })
);

const outPath = `${args.in}.optimized.glb`;
await io.write(outPath, doc);
const outBytes = (await readFile(outPath)).length;
console.log(
  `[optimize-scan] ${(inBytes / 1e6).toFixed(1)}MB → ${(outBytes / 1e6).toFixed(1)}MB (${(inBytes / outBytes).toFixed(1)}:1) → ${outPath}`
);
